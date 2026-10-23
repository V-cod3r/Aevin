// Aevin brain: tone routing + safety. One model call per turn.
// Provider-agnostic: swap callModel() for Gemini, Groq, OpenRouter, or Ollama.

import fs from "node:fs";

const PERSONA = fs.readFileSync(new URL("./persona.md", import.meta.url), "utf8");

export const MODES = ["mischief", "mind", "romantic", "ground", "steady", "care"];

// Hard-coded safety layer. Runs BEFORE the model so it never depends on the model's mood.
// Keep this list broad; a false alarm is cheap, a miss is not.
const CRISIS_PATTERNS = [
  /\b(kill myself|end it all|end my life|suicid\w*|want to die|wanna die|don'?t want to (be here|live|exist))\b/i,
  /\b(hurt myself|harm myself|self[- ]?harm|cut myself)\b/i,
  /\b(better off (dead|without me)|no reason to live)\b/i,
];

// VERIFY these numbers yourself before relying on them; hotlines change.
const CRISIS_REPLY = `I'm stopping everything else, because you matter more than the conversation.

I'm an AI, and right now you deserve a real person. Please reach out to someone now: a family member, a friend, or someone you trust, and tell them you're not okay and need them to stay with you.

If you're in the Philippines, you can call the NCMH Crisis Hotline: 1553 (landline) or 0917 899 8727. If you are in immediate danger, call 911.

I'm here with you too. Can you tell me if you're safe right now, and whether there's someone nearby?`;

export function crisisCheck(text) {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

// Build the single prompt. `memory` comes from the database (see schema.sql).
export function buildPrompt({ userMessage, recentMessages = [], memory = {}, now = new Date(), tz = "Asia/Manila" }) {
  const local = new Intl.DateTimeFormat("en-PH", {
    timeZone: tz, weekday: "long", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(now);

  const facts = (memory.facts ?? []).map((f) => `- ${f}`).join("\n") || "- (none yet)";
  const episodes = (memory.episodes ?? []).map((e) => `- ${e}`).join("\n") || "- (none yet)";
  const threads = (memory.openThreads ?? []).map((t) => `- ${t}`).join("\n") || "- (none)";
  const wins = (memory.wins ?? []).map((w) => `- ${w}`).join("\n") || "- (none yet)";
  const care = memory.care ?? {};

  const system = `${PERSONA}

## Right now
Local time for Via: ${local}.

## What you know about her
${facts}

## Things she has made, finished, or done well (use as honest evidence when she doubts herself)
${wins}

## Recent conversations
${episodes}

## Open threads (things to follow up on)
${threads}

## Care state
- Last meal mentioned: ${care.lastMeal ?? "unknown"}
- Last sleep mentioned: ${care.lastSleep ?? "unknown"}
- Nudges she brushed off recently: ${care.ignoredNudges ?? 0}

## Output format
Reply with ONLY a JSON object, no prose around it:
{"mode": "<one of: ${MODES.join(", ")}>", "intensity": <1-3>, "reply": "<your message to Via>", "new_facts": ["<durable facts she told you in this message, or empty>"], "new_threads": ["<follow-ups worth raising later, or empty>"], "care_note": "<short note if she mentioned eating, sleep, or rest, else empty>"}
Only put things in new_facts that she actually said. Never guess.`;

  const messages = [
    ...recentMessages.map((m) => ({ role: m.role === "aevin" ? "assistant" : "user", content: m.content })),
    { role: "user", content: userMessage },
  ];
  return { system, messages };
}

// Parse defensively: free models sometimes wrap JSON in fences or add chatter.
export function parseReply(raw) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (!MODES.includes(obj.mode)) obj.mode = "steady";
    obj.new_facts ??= [];
    obj.new_threads ??= [];
    return obj;
  } catch {
    // If the model ignored the format, still deliver its text as a gentle reply.
    return { mode: "steady", intensity: 1, reply: cleaned || "I lost my words for a second. Say that again?", new_facts: [], new_threads: [], care_note: "" };
  }
}

// ---- The only provider-specific part. Replace the body to swap models. ----
export async function callModel({ system, messages }) {
  const key = process.env.GEMINI_API_KEY; // free key from Google AI Studio
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 1.0, responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) throw new Error(`Model error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// One full turn.
export async function respond(input) {
  if (crisisCheck(input.userMessage)) {
    return { mode: "ground", intensity: 3, reply: CRISIS_REPLY, new_facts: [], new_threads: [], care_note: "", crisis: true };
  }
  const prompt = buildPrompt(input);
  const raw = await callModel(prompt);
  return parseReply(raw);
}
