// ============================================================
// The ONLY file that knows which AI provider Aevin uses.
// Today: Google Gemini (free tier). To switch to Groq, OpenRouter, a local
// Ollama server, etc., rewrite `generate` and `embed` — nothing else changes.
// (If you change the embedding model, change vector(768) in the schema too.)
// ============================================================

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const model = () => Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const embedModel = () => Deno.env.get("GEMINI_EMBED_MODEL") ?? "gemini-embedding-001";
const apiKey = () => {
  const k = Deno.env.get("GEMINI_API_KEY");
  if (!k) throw new Error("GEMINI_API_KEY is not set");
  return k;
};

export type Turn = { role: "user" | "assistant"; content: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(url: string, body: unknown, attempts = 3): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
      body: JSON.stringify(body),
    });
    if (res.ok) return await res.json();
    const text = await res.text();
    lastErr = new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
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

  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.9,
    maxOutputTokens: opts.maxTokens ?? 800,
  };
  if (opts.json) generationConfig.responseMimeType = "application/json";
  // 2.5-flash "thinks" by default and thinking tokens eat the output budget; Aevin doesn't need it.
  if (/2\.5-flash/.test(model())) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const data = await post(`${BASE}/models/${model()}:generateContent`, {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents,
    generationConfig,
  });

  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
  if (!text) throw new Error(`Empty model response (finishReason: ${cand?.finishReason ?? "unknown"})`);
  return text;
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
