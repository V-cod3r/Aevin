-- Aevin: gestures (flowers, stars, hug, candle, confetti, letter) attached to messages.
alter table public.messages
  add column if not exists gesture text
  check (gesture in ('flowers', 'stars', 'hug', 'candle', 'confetti', 'letter'));
