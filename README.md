# Aevin

A companion with memory, tone-aware replies, and proactive check-ins.
Built to run on free tiers (Supabase, Gemini, Cloudflare Pages / Vercel).

- `brain/`: persona, tone router, safety layer
- `supabase/`: database schema, shared functions, scheduled jobs
- `web/`: the PWA (coming)

Secrets live in `.env` locally, Supabase secrets, and GitHub Actions secrets. Never in this repo.

## Deploying the app
Vercel: import this repo, set Root Directory to `web`, and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
