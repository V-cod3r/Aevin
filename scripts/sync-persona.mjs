// Keeps the Edge Functions' copy of Aevin's persona in sync with brain/persona.md.
// Run after editing persona.md:  node scripts/sync-persona.mjs
import fs from "node:fs";
const md = fs.readFileSync(new URL("../brain/persona.md", import.meta.url), "utf8");
const out = `// AUTO-GENERATED from brain/persona.md by scripts/sync-persona.mjs. Edit the .md, not this file.\nexport const PERSONA = ${JSON.stringify(md)};\n`;
fs.writeFileSync(new URL("../supabase/functions/_shared/persona.ts", import.meta.url), out);
console.log("persona.ts updated");
