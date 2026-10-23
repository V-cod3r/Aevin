// Aevin's brain for Edge Functions: tone routing prompt, safety check, reply parsing.
import { PERSONA } from "./persona.ts";

export const MODES = ["mischief", "mind", "romantic", "ground", "steady", "care"] as const;
export type Mode = typeof MODES[number];

export const GESTURES = ["flowers", "stars", "hug", "candle", "confetti", "letter"] as const;
export type Gesture = typeof GESTURES[number];

// Runs BEFORE the model so safety never depends on the model's mood. Broad on purpose.
const CRISIS = [
  /\b(kill myself|end it all|end my life|suicid\w*|want to die|wanna die|don'?t want to (be here|live|exist))\b/i,
  /\b(hurt myself|harm myself|self[- ]?harm|cut myself)\b/i,
  /\b(better off (dead|without me)|no reason to live)\b/i,
];
export const crisisCheck = (t: string) => CRISIS.some((re) => re.test(t));

// VERIFY these numbers yourself; hotlines change.
export const CRISIS_REPLY = `I'm stopping everything else, because you matter more than the conversation.

I'm an AI, and right now you deserve a real person. Please reach out to someone now: a family member, a friend, or someone you trust, and tell them you're not okay and need them to stay with you.

If you're in the Philippines, you can call the NCMH Crisis Hotline: 1553 (landline) or 0917 899 8727. If you are in immediate danger, call 911.

I'm here with you too. Can you tell me if you're safe right now, and whether there's someone nearby?`;

export type Context = {
  name: string;
  tz: string;
  facts: string[];
  wins: string[];
  episodes: string[];
  threads: string[];
  hasImage?: boolean;
  careNote?: string | null;
  careNoteAt?: string | null;
  ignoredNudges: number;
  summary?: string;
};

const list = (xs: string[], empty = "(none yet)") => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : `- ${empty}`);

export function buildSystem(c: Context, now = new Date()): string {
  const local = new Intl.DateTimeFormat("en-PH", {
    timeZone: c.tz, weekday: "long", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(now);

  return `${PERSONA}

## Right now
Her name is ${c.name}. Local time for her: ${local}.

## What you know about her
${list(c.facts)}

## Things she has made, finished, or done well (honest evidence for self-doubt moments)
${list(c.wins)}

## Relationship summary
${c.summary || "(still getting to know each other)"}

## Earlier moments that seem relevant
${list(c.episodes)}

## Open threads (things to follow up on, only when it fits)
${list(c.threads, "(none)")}

## Care state
- Last care note: ${c.careNote ? `${c.careNote} (${c.careNoteAt ?? "unknown time"})` : "none"}
- Nudges she brushed off recently: ${c.ignoredNudges}

${c.hasImage ? "## This message\nShe attached an image. Look at it closely and respond to what you actually see.\n\n" : ""}## Output format
Reply with ONLY a JSON object, no prose around it:
{"mode": "<one of: ${MODES.join(", ")}>", "intensity": <1-3>, "reply": "<your message>", "new_facts": ["<durable facts she told you in THIS message>"], "new_wins": ["<things she made, finished, or did well, that she mentioned in THIS message>"], "new_threads": ["<follow-ups worth raising later>"], "care_note": "<short note if she mentioned eating, sleep, or rest, else empty>", "gesture": "<none, or one of: ${GESTURES.join(", ")}>"}
Only include things she actually said. Never guess. Use empty arrays when there is nothing.`;
}

export type Parsed = {
  mode: Mode; intensity: number; reply: string;
  new_facts: string[]; new_wins: string[]; new_threads: string[]; care_note: string;
  gesture: Gesture | null;
};

const strs = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 300)) : [];

// Free models sometimes wrap JSON in fences or add chatter, so parse defensively.
export function parseReply(raw: string): Parsed {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    const o = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    if (typeof o.reply !== "string" || !o.reply.trim()) throw new Error("no reply");
    return {
      mode: (MODES as readonly string[]).includes(o.mode) ? o.mode : "steady",
      intensity: Math.min(3, Math.max(1, Number(o.intensity) || 1)),
      reply: o.reply.trim(),
      new_facts: strs(o.new_facts), new_wins: strs(o.new_wins), new_threads: strs(o.new_threads),
      care_note: typeof o.care_note === "string" ? o.care_note.trim().slice(0, 200) : "",
      gesture: (GESTURES as readonly string[]).includes(o.gesture) ? o.gesture : null,
    };
  } catch {
    return {
      mode: "steady", intensity: 1,
      reply: cleaned && !cleaned.startsWith("{") ? cleaned : "I lost my words for a second. Say that again?",
      new_facts: [], new_wins: [], new_threads: [], care_note: "", gesture: null,
    };
  }
}
