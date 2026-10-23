// POST /functions/v1/chat   { "message": "..." }   (user must be signed in)
import { adminClient } from "../_shared/db.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { generate, embed } from "../_shared/llm.ts";
import { buildSystem, crisisCheck, CRISIS_REPLY, parseReply, GESTURES } from "../_shared/brain.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Base64 without blowing the call stack on big images.
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Who is asking? Verified from their login token, never from the request body.
  const authed = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: u } = await authed.auth.getUser();
  const userId = u?.user?.id;
  if (!userId) return json({ error: "Not signed in" }, 401);

  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim().slice(0, 4000);
  // An image must live in this user's own folder of the aevin-images bucket.
  const imagePath = typeof body.image_path === "string" && body.image_path.startsWith(`${userId}/`) && !body.image_path.includes("..")
    ? body.image_path : null;
  if (!message && !imagePath) return json({ error: "Empty message" }, 400);

  // A gift from her (flowers, stars...) arrives as a gesture name alongside the message text.
  const userGesture = (GESTURES as readonly string[]).includes(body.gesture) ? String(body.gesture) : null;

  const db = adminClient();
  const save = (role: "user" | "assistant", content: string, gesture: string | null = null, image: string | null = null) =>
    db.from("messages").insert({ user_id: userId, role, content, ...(gesture ? { gesture } : {}), ...(image ? { image_path: image } : {}) });

  // Safety first, before any model call.
  if (crisisCheck(message)) {
    await save("user", message, userGesture, imagePath);
    await save("assistant", CRISIS_REPLY);
    await db.from("companion_state").update({ last_contact_at: new Date().toISOString(), ignored_nudges: 0 }).eq("user_id", userId);
    return json({ reply: CRISIS_REPLY, mode: "ground", crisis: true });
  }

  try {
    const [{ data: profile }, { data: state }, { data: recent }, { data: threads }, { data: core }] = await Promise.all([
      db.from("profiles").select("display_name,timezone").eq("id", userId).single(),
      db.from("companion_state").select("*").eq("user_id", userId).single(),
      db.from("messages").select("role,content,image_path").eq("user_id", userId).order("created_at", { ascending: false }).limit(14),
      db.from("threads").select("description").eq("user_id", userId).eq("status", "open").order("created_at", { ascending: false }).limit(5),
      db.from("memories").select("kind,content").eq("user_id", userId).in("kind", ["fact", "preference", "win"])
        .order("importance", { ascending: false }).order("created_at", { ascending: false }).limit(25),
    ]);

    // Relevant older moments via vector search (best effort; chat still works if it fails).
    let episodes: string[] = [];
    try {
      if (!message) throw new Error("no text to search with");
      const qv = await embed(message, "RETRIEVAL_QUERY");
      const { data: hits } = await db.rpc("match_memories", { query_embedding: qv, match_user: userId, match_count: 5 });
      episodes = (hits ?? []).filter((h: any) => h.similarity > 0.55).map((h: any) => h.content);
    } catch (_) { /* ignore */ }

    const system = buildSystem({
      name: profile?.display_name ?? "Via",
      tz: profile?.timezone ?? "Asia/Manila",
      facts: (core ?? []).filter((m) => m.kind !== "win").map((m) => m.content),
      wins: (core ?? []).filter((m) => m.kind === "win").map((m) => m.content),
      episodes,
      threads: (threads ?? []).map((t) => t.description),
      careNote: state?.last_care_note, careNoteAt: state?.last_care_note_at,
      ignoredNudges: state?.ignored_nudges ?? 0,
      summary: state?.summary,
      hasImage: !!imagePath,
    });

    const history = (recent ?? []).reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: `${m.content}${m.image_path ? " [she sent an image]" : ""}`.trim(),
    }));

    // A picture problem should become an honest reply, never silence.
    let image: { mime: string; data: string } | undefined;
    let imageNote = "";
    if (imagePath) {
      try {
        const { data: blob, error: dlErr } = await db.storage.from("aevin-images").download(imagePath);
        if (dlErr || !blob) throw new Error(`could not read it from storage (${dlErr?.message ?? "missing"})`);
        if (blob.size > 4_000_000) throw new Error("the picture is too large");
        const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
        image = { mime, data: toBase64(new Uint8Array(await blob.arrayBuffer())) };
      } catch (e) {
        console.error("image load failed:", e);
        imageNote = `[She sent a picture, but it did not come through: ${String((e as Error).message).slice(0, 120)}. Tell her honestly you could not see it and ask her to try again.]`;
      }
    }

    await save("user", message, userGesture, imagePath); // keep her words even if the model call fails
    const ask = (turn: { role: "user"; content: string; image?: { mime: string; data: string } }) =>
      generate({ system, turns: [...history, turn], json: true, temperature: 1.0, maxTokens: 700 });
    let raw: string;
    try {
      raw = await ask({ role: "user", content: [message, imageNote].filter(Boolean).join("\n"), image });
    } catch (e) {
      if (!image) throw e;
      // The model could not handle the picture; answer honestly instead of failing.
      console.error("generate with image failed:", e);
      raw = await ask({
        role: "user",
        content: [message, "[She sent a picture, but the model could not process it. Tell her honestly you could not see it, and invite her to try again or describe it.]"].filter(Boolean).join("\n"),
      });
    }
    const out = parseReply(raw);

    await save("assistant", out.reply, out.gesture);

    // Remember what she actually said (embeddings are best effort).
    const rows: any[] = [];
    for (const [kind, items] of [["fact", out.new_facts], ["win", out.new_wins]] as const) {
      for (const content of items) {
        let embedding: number[] | null = null;
        try { embedding = await embed(content); } catch (_) { /* store without */ }
        rows.push({ user_id: userId, kind, content, importance: kind === "win" ? 4 : 3, embedding });
      }
    }
    if (rows.length) await db.from("memories").insert(rows);
    if (out.new_threads.length) {
      await db.from("threads").insert(out.new_threads.map((description) => ({ user_id: userId, description })));
    }

    const now = new Date().toISOString();
    await db.from("companion_state").update({
      last_contact_at: now, ignored_nudges: 0, last_mode: out.mode, updated_at: now,
      ...(out.care_note ? { last_care_note: out.care_note, last_care_note_at: now } : {}),
    }).eq("user_id", userId);

    return json({ reply: out.reply, mode: out.mode, gesture: out.gesture });
  } catch (e) {
    console.error(e);
    const detail = String((e as Error)?.message ?? e).slice(0, 300);
    return json({ reply: "My thoughts got tangled for a moment. Try me again in a minute?", mode: "steady", error: true, detail });
  }
});
