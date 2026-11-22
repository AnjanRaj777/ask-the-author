-- Phase 3: Saved Notes enhancements, Feedback enhancements, and Book Clubs

-- 1. Enhance saved_notes so notes are self-contained (survive conversation clears)
alter table saved_notes
  alter column message_id drop not null;

alter table saved_notes
  add column if not exists book_id uuid references books(id) on delete cascade,
  add column if not exists question text,
  add column if not exists answer text,
  add column if not exists answer_mode text,
  add column if not exists citations jsonb not null default '[]'::jsonb;

create index if not exists saved_notes_user_book_idx on saved_notes (user_id, book_id, created_at desc);

-- 2. Enhance feedback so it can also capture book_id, question, answer for admin review
alter table feedback
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists book_id uuid references books(id) on delete set null,
  add column if not exists question text,
  add column if not exists answer text;

create index if not exists feedback_created_idx on feedback (created_at desc);

-- 3. Book Clubs (shared rooms with invite links and per-member spoiler limits)
create table if not exists book_clubs (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references books(id) on delete cascade,
  name         text not null,
  invite_code  text not null unique,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table if not exists book_club_members (
  club_id       uuid not null references book_clubs(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null,
  spoiler_limit int not null default 1,
  joined_at     timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table if not exists book_club_messages (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references book_clubs(id) on delete cascade,
  user_id            uuid references auth.users(id) on delete set null,
  author_name        text not null,
  role               text not null check (role in ('member', 'assistant')),
  content            text not null,
  answer_mode        text,
  citations          jsonb not null default '[]'::jsonb,
  spoiler_limit_used int,
  created_at         timestamptz not null default now()
);

create index if not exists book_club_messages_club_idx on book_club_messages (club_id, created_at asc);

-- RLS for Book Clubs
alter table book_clubs enable row level security;
alter table book_club_members enable row level security;
alter table book_club_messages enable row level security;

drop policy if exists "book_clubs_select_authenticated" on book_clubs;
create policy "book_clubs_select_authenticated" on book_clubs
  for select using (auth.uid() is not null);

drop policy if exists "book_clubs_insert_authenticated" on book_clubs;
create policy "book_clubs_insert_authenticated" on book_clubs
  for insert with check (auth.uid() = created_by);

drop policy if exists "book_club_members_select_club" on book_club_members;
create policy "book_club_members_select_club" on book_club_members
  for select using (
    exists (
      select 1 from book_club_members m
      where m.club_id = book_club_members.club_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "book_club_members_insert_self" on book_club_members;
create policy "book_club_members_insert_self" on book_club_members
  for insert with check (auth.uid() = user_id);

drop policy if exists "book_club_members_update_self" on book_club_members;
create policy "book_club_members_update_self" on book_club_members
  for update using (auth.uid() = user_id);

drop policy if exists "book_club_messages_select_member" on book_club_messages;
create policy "book_club_messages_select_member" on book_club_messages
  for select using (
    exists (
      select 1 from book_club_members m
      where m.club_id = book_club_messages.club_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "book_club_messages_insert_member" on book_club_messages;
create policy "book_club_messages_insert_member" on book_club_messages
  for insert with check (
    exists (
      select 1 from book_club_members m
      where m.club_id = book_club_messages.club_id
        and m.user_id = auth.uid()
    )
  );
