// POST /functions/v1/chat   { "message": "..." }   (user must be signed in)
import { adminClient } from "../_shared/db.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { generate, embed } from "../_shared/llm.ts";
import { buildSystem, crisisCheck, CRISIS_REPLY, parseReply } from "../_shared/brain.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  if (!message) return json({ error: "Empty message" }, 400);

  const db = adminClient();
  const save = (role: "user" | "assistant", content: string) =>
    db.from("messages").insert({ user_id: userId, role, content });

  // Safety first, before any model call.
  if (crisisCheck(message)) {
    await save("user", message);
    await save("assistant", CRISIS_REPLY);
    await db.from("companion_state").update({ last_contact_at: new Date().toISOString(), ignored_nudges: 0 }).eq("user_id", userId);
    return json({ reply: CRISIS_REPLY, mode: "ground", crisis: true });
  }

  try {
    const [{ data: profile }, { data: state }, { data: recent }, { data: threads }, { data: core }] = await Promise.all([
      db.from("profiles").select("display_name,timezone").eq("id", userId).single(),
      db.from("companion_state").select("*").eq("user_id", userId).single(),
      db.from("messages").select("role,content").eq("user_id", userId).order("created_at", { ascending: false }).limit(14),
      db.from("threads").select("description").eq("user_id", userId).eq("status", "open").order("created_at", { ascending: false }).limit(5),
      db.from("memories").select("kind,content").eq("user_id", userId).in("kind", ["fact", "preference", "win"])
        .order("importance", { ascending: false }).order("created_at", { ascending: false }).limit(25),
    ]);

    // Relevant older moments via vector search (best effort; chat still works if it fails).
    let episodes: string[] = [];
    try {
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
    });

    const history = (recent ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const raw = await generate({
      system, turns: [...history, { role: "user", content: message }], json: true, temperature: 1.0, maxTokens: 700,
    });
    const out = parseReply(raw);

    await save("user", message);
    await save("assistant", out.reply);

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

    return json({ reply: out.reply, mode: out.mode });
  } catch (e) {
    console.error(e);
    return json({ reply: "My thoughts got tangled for a moment. Try me again in a minute?", mode: "steady", error: true });
  }
});
