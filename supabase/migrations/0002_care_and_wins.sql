-- Aevin: wins (honest evidence for self-doubt moments) + care state the tone router uses.

alter table public.memories drop constraint if exists memories_kind_check;
alter table public.memories add constraint memories_kind_check
  check (kind in ('fact', 'episode', 'preference', 'win'));

alter table public.companion_state
  add column if not exists last_mode          text,
  add column if not exists last_care_note     text,
  add column if not exists last_care_note_at  timestamptz,
  add column if not exists ignored_nudges     smallint not null default 0;
