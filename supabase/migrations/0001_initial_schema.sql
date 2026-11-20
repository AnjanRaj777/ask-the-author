-- Ask the Author: Initial Schema + Hybrid Search RPC
-- Run this migration in the Supabase SQL Editor or via `supabase db push`

create extension if not exists vector;

-- 1. Books (seeded public-domain books + user uploads)
create table if not exists books (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references auth.users(id) on delete set null, -- null = public library book
  title           text not null,
  author          text not null,
  source          text not null check (source in ('public_domain', 'upload')),
  rights_note     text,
  language        text not null default 'en',
  cover_url       text,
  file_path       text,
  status          text not null default 'pending'
                  check (status in ('pending', 'parsing', 'embedding', 'ready', 'failed')),
  chapter_count   int not null default 0,
  persona_mode    text not null default 'guide'
                  check (persona_mode in ('author', 'guide')),
  embedding_model text,
  created_at      timestamptz not null default now()
);

-- 2. Chapters
create table if not exists chapters (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books(id) on delete cascade,
  idx         int not null, -- 1-based reading order (used for spoiler filter)
  title       text,
  start_page  int,
  summary     text,
  unique (book_id, idx)
);

-- 3. Chunks (never cross chapter boundaries)
create table if not exists chunks (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books(id) on delete cascade,
  chapter_idx int not null,
  seq         int not null, -- global order within the book
  page        int,          -- PDFs; null for EPUB/TXT
  char_start  int,
  char_end    int,
  content     text not null,
  token_count int,
  embedding   vector(1024), -- matches Voyage-3 (1024); adjust if using another dimension
  fts         tsvector generated always as (to_tsvector('english', content)) stored
);

create index if not exists chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index if not exists chunks_fts_idx on chunks using gin (fts);
create index if not exists chunks_book_chapter_idx on chunks (book_id, chapter_idx);

-- 4. Personas
create table if not exists personas (
  book_id           uuid primary key references books(id) on delete cascade,
  display_name      text not null,
  voice_notes       text,
  themes            text[] default '{}',
  bio_facts         text,
  style_samples     text[] default '{}',
  starter_questions text[] default '{}'
);

-- 5. Conversations
create table if not exists conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  book_id       uuid not null references books(id) on delete cascade,
  spoiler_limit int not null default 1,
  created_at    timestamptz not null default now()
);

-- 6. Messages
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  answer_mode     text check (answer_mode in ('grounded', 'speculation', 'not_in_book')),
  citations       jsonb default '[]'::jsonb,
  model           text,
  input_tokens    int,
  output_tokens   int,
  created_at      timestamptz not null default now()
);

-- 7. Saved Notes
create table if not exists saved_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  message_id  uuid not null references messages(id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now()
);

-- 8. Feedback
create table if not exists feedback (
  message_id  uuid not null references messages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rating      smallint not null check (rating in (-1, 1)),
  reason      text,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- 9. Hybrid Search RPC with hard spoiler filter (Reciprocal Rank Fusion)
create or replace function match_book_chunks(
  p_book_id uuid,
  p_spoiler_limit int,
  p_query_text text,
  p_query_embedding vector(1024),
  p_match_count int default 8,
  p_rrf_k int default 60
)
returns table (
  id uuid,
  book_id uuid,
  chapter_idx int,
  chapter_title text,
  seq int,
  page int,
  content text,
  score float
)
language sql
stable
as $$
  with vector_matches as (
    select
      c.id,
      row_number() over (order by c.embedding <=> p_query_embedding) as rank_ix
    from chunks c
    where c.book_id = p_book_id
      and c.chapter_idx <= p_spoiler_limit
      and c.embedding is not null
    order by c.embedding <=> p_query_embedding
    limit p_match_count * 3
  ),
  keyword_matches as (
    select
      c.id,
      row_number() over (order by ts_rank_cd(c.fts, websearch_to_tsquery('english', p_query_text)) desc) as rank_ix
    from chunks c
    where c.book_id = p_book_id
      and c.chapter_idx <= p_spoiler_limit
      and p_query_text <> ''
      and c.fts @@ websearch_to_tsquery('english', p_query_text)
    order by ts_rank_cd(c.fts, websearch_to_tsquery('english', p_query_text)) desc
    limit p_match_count * 3
  ),
  fused as (
    select
      coalesce(v.id, k.id) as id,
      coalesce(1.0 / (p_rrf_k + v.rank_ix), 0.0) +
      coalesce(1.0 / (p_rrf_k + k.rank_ix), 0.0) as rrf_score
    from vector_matches v
    full outer join keyword_matches k on v.id = k.id
  )
  select
    c.id,
    c.book_id,
    c.chapter_idx,
    ch.title as chapter_title,
    c.seq,
    c.page,
    c.content,
    f.rrf_score::float as score
  from fused f
  join chunks c on c.id = f.id
  left join chapters ch on ch.book_id = c.book_id and ch.idx = c.chapter_idx
  where c.chapter_idx <= p_spoiler_limit -- defense-in-depth spoiler guard
  order by f.rrf_score desc
  limit p_match_count;
$$;
