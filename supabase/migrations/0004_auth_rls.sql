-- Enable Row-Level Security for user-owned accounts, conversations, messages, saved notes, and feedback.

alter table books enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table saved_notes enable row level security;
alter table feedback enable row level security;

-- Books: public_domain / shared books (owner_id is null) are readable by anyone; private uploads only by owner.
drop policy if exists "books_select_public_or_owner" on books;
create policy "books_select_public_or_owner" on books
  for select using (owner_id is null or auth.uid() = owner_id);

drop policy if exists "books_insert_owner" on books;
create policy "books_insert_owner" on books
  for insert with check (auth.uid() = owner_id or owner_id is null);

drop policy if exists "books_update_owner" on books;
create policy "books_update_owner" on books
  for update using (auth.uid() = owner_id);

-- Conversations: users can manage only their own conversations.
drop policy if exists "conversations_owner_all" on conversations;
create policy "conversations_owner_all" on conversations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Messages: users can access messages belonging to their own conversations.
drop policy if exists "messages_owner_all" on messages;
create policy "messages_owner_all" on messages
  for all using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- Saved notes: users can manage only their own notes.
drop policy if exists "saved_notes_owner_all" on saved_notes;
create policy "saved_notes_owner_all" on saved_notes
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Feedback: users can manage only their own feedback.
drop policy if exists "feedback_owner_all" on feedback;
create policy "feedback_owner_all" on feedback
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
