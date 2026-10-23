// ============================================================
// The ONLY file that knows which AI provider Aevin uses.
// Today: Google Gemini (free tier). To switch to Groq, OpenRouter, a local
// Ollama server, etc., rewrite `generate` and `embed` — nothing else changes.
// (If you change the embedding model, change vector(768) in the schema too.)
// ============================================================

const BASE = "https://generativelanguage.googleapis.com/v1beta";
// Models are tried in order until one works for your account (Google retires and
// re-tiers models often). Set GEMINI_MODEL in Supabase secrets to force a first choice.
const MODEL_CHAIN = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
];
let workingModel: string | null = null; // remembered while this instance stays warm
const modelChain = () => {
  const first = Deno.env.get("GEMINI_MODEL");
  const order = [first, workingModel, ...MODEL_CHAIN].filter((m): m is string => !!m);
  return [...new Set(order)];
};
const embedModel = () => Deno.env.get("GEMINI_EMBED_MODEL") ?? "gemini-embedding-001";
const apiKey = () => {
  const k = Deno.env.get("GEMINI_API_KEY");
  if (!k) throw new Error("GEMINI_API_KEY is not set");
  return k;
};

export type Turn = { role: "user" | "assistant"; content: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(url: string, body: unknown, attempts = 2): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000), // a stalled model should not hold up the fallback
      });
    } catch (e) {
      // Timeout or network error: report as "overloaded" so the next model gets a turn.
      throw Object.assign(new Error(`LLM timeout/network: ${String((e as Error).message).slice(0, 120)}`), { status: 503 });
    }
    if (res.ok) return await res.json();
    const text = await res.text();
    lastErr = Object.assign(new Error(`LLM ${res.status}: ${text.slice(0, 300)}`), { status: res.status });
    // Retry only on rate limits / temporary overload.
    if (res.status !== 429 && res.status !== 503) break;
    await sleep(800 * (i + 1));
  }
  throw lastErr;
}

/** Turn a chat history into Gemini's alternating user/model format. */
function toContents(turns: Turn[]) {
  const merged: { role: "user" | "model"; text: string }[] = [];
  for (const t of turns) {
    const role = t.role === "assistant" ? "model" : "user";
    const last = merged[merged.length - 1];
    if (last && last.role === role) last.text += "\n" + t.content;
    else merged.push({ role, text: t.content });
  }
  while (merged.length && merged[0].role === "model") merged.shift(); // must start with the user
  return merged.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

export async function generate(opts: {
  system: string;
  turns: Turn[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const contents = toContents(opts.turns);
  if (!contents.length) throw new Error("generate() called with no user turn");

  const base: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.9,
    // Thinking tokens can share this budget on newer models, so leave generous room.
    maxOutputTokens: Math.max(opts.maxTokens ?? 800, 1500),
  };
  if (opts.json) base.responseMimeType = "application/json";

  const call = async (m: string, thinking: Record<string, unknown> | null) => {
    const generationConfig = thinking ? { ...base, thinkingConfig: thinking } : base;
    const data = await post(`${BASE}/models/${m}:generateContent`, {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents,
      generationConfig,
    });
    const cand = data?.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p: any) => p.thought ? "" : (p.text ?? "")).join("").trim();
    if (!text) throw Object.assign(new Error(`Empty model response (finishReason: ${cand?.finishReason ?? "unknown"})`), { status: 0 });
    return text;
  };

  const failures: string[] = [];
  for (const m of modelChain()) {
    // Keep Aevin quick: low thinking on 3.x, none on 2.5. If the field is refused, retry without it.
    const thinking = /gemini-2\.5-flash$/.test(m) ? { thinkingBudget: 0 } : /gemini-3/.test(m) ? { thinkingLevel: "low" } : null;
    try {
      const text = await call(m, thinking).catch(async (e) => {
        if (thinking && (e as any)?.status === 400) return await call(m, null);
        throw e;
      });
      workingModel = m;
      return text;
    } catch (e) {
      const status = (e as any)?.status;
      failures.push(`${m}: ${String((e as Error).message).slice(0, 160)}`);
      // Wrong/retired model, no access, bad request, quota, or overload: try the next model.
      if (status === 0 || [400, 403, 404, 429, 500, 503].includes(status)) continue;
      throw e;
    }
  }
  throw new Error(`No Gemini model worked. ${failures.join(" | ")}`.slice(0, 600));
}

/** Text -> 768-number vector for memory search. */
export async function embed(
  text: string,
  task: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" = "RETRIEVAL_DOCUMENT",
): Promise<number[]> {
  const data = await post(`${BASE}/models/${embedModel()}:embedContent`, {
    content: { parts: [{ text: text.slice(0, 2000) }] },
    taskType: task,
    outputDimensionality: 768,
  });
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== 768) {
    throw new Error("Unexpected embedding response");
  }
  return values;
}
