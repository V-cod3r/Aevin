// Quick offline test of routing plumbing (no API key needed).
import { crisisCheck, buildPrompt, parseReply } from "./router.js";

console.log("crisis detect:", crisisCheck("i just want to die"), crisisCheck("this exam is killing me lol"));

const p = buildPrompt({
  userMessage: "ok i have 3 deadlines and i haven't slept and i think i'm just bad at everything",
  memory: { facts: ["Studies computer science"], wins: ["Built a quiz app"], care: { ignoredNudges: 2 } },
});
console.log("prompt chars:", p.system.length, "| messages:", p.messages.length);

console.log(parseReply('```json\n{"mode":"ground","intensity":2,"reply":"Hey. Breathe with me."}\n```'));
console.log(parseReply("not json at all"));
