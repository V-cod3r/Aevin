-- ============================================================
-- Aevin — scheduler
-- Run this AFTER you've deployed the `checkin` function.
-- Before running:
--   1. Dashboard → Database → Extensions → enable  pg_cron  and  pg_net
--   2. Replace YOUR-PROJECT-REF and YOUR-CRON-SECRET below
--      (the secret must match the CRON_SECRET you set with `supabase secrets set`).
-- ============================================================

-- Keep the secret in Vault instead of pasting it into the job text.
select vault.create_secret('YOUR-CRON-SECRET', 'aevin_cron_secret');

-- Every 30 minutes, ask the checkin function whether Aevin has a reason to reach out.
-- (The function itself decides: quiet hours, daily cap, due follow-ups, morning, long silence.)
select cron.schedule(
  'aevin-checkin',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/checkin',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'aevin_cron_secret')
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- To pause Aevin's check-ins at any time:   select cron.unschedule('aevin-checkin');
