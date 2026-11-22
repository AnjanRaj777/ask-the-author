# Ask the Author

> Chat with an AI simulation in the author's voice, grounded in the book's actual passages with chapter citations and spoiler protection.

Ask the Author is a Next.js + Supabase RAG application where readers can converse with author personas about specific books—without getting spoiled past the chapter they have read.

---

## Features

- **Spoiler-Protected RAG Chat (`/chat/[bookId]`):** Set your current reading progress ("Read up to" chapter/book) so retrieval and responses never reveal later plot points or ideas.
- **Grounded Answers & Citations:** Retrieves relevant passages from pgvector and cites chapter/section context, with an inspectable chunk context endpoint (`/api/chunks/[id]/context`).
- **Multiple Ways to Add Books:**
  - **Built-in Library:** Includes preset titles (*Meditations*, *The Great Gatsby*, *Atomic Habits*, *Thinking, Fast and Slow*).
  - **Upload & Import:** Upload `PDF`, `EPUB`, or `TXT` files (`/api/books/upload`), paste text (`/api/books/from-text`), or search/import books (`/api/books/search`, `/api/books/import`).
  - **No-File Preset Mode:** Chat with supported titles even before uploading a full text (`/api/books/no-file`).
- **Authentication & Guest Mode (`/login`):**
  - Supabase Auth (`@supabase/ssr`) supporting **Email + Password**, **Google OAuth**, **Email Magic Links**, and **Password Reset** via `/auth/callback`.
  - **Guest Mode:** Try chatting without signing in (rate-limited by `GUEST_CHAT_LIMIT`, default 5 messages per 24h), with automatic migration of local guest chats into your account upon sign-in (`/api/auth/migrate-guest`).
- **Book Clubs (`/clubs`, `/clubs/[code]`):** Create and join shared club rooms to discuss books together.
- **Notes (`/notes`):** Save and manage reading notes alongside your conversations.
- **Feedback Review (`/admin/feedback`):** Submit and review response feedback (`/api/feedback`).

---

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling & UI:** Tailwind CSS v4, `motion`, `lucide-react`, Cormorant Garamond & Inter (`next/font/google`)
- **Database & Auth:** Supabase (PostgreSQL, `pgvector`, Supabase Auth via `@supabase/ssr`)
- **AI & Embeddings:** Anthropic Claude (`ANTHROPIC_API_KEY`), Voyage AI (`voyage-3`) or OpenAI embeddings (`openai`)
- **Document Parsing:** `unpdf` (PDF), `jszip` + `cheerio` (EPUB/HTML)

---

## Project Structure

```text
├── books/personas/          # Author persona definitions (e.g. pride-and-prejudice.json)
├── docs/                    # Project documentation
├── evals/                   # Evaluation datasets & checks
├── scripts/
│   ├── ingest.ts            # CLI script to chunk, embed, and ingest books
│   └── eval.ts              # CLI script to run RAG evaluations
├── src/
│   ├── app/
│   │   ├── admin/feedback/  # Feedback review page
│   │   ├── api/             # Route handlers (auth, books, chat, chunks, clubs, notes, feedback, health)
│   │   ├── auth/callback/   # Supabase OAuth / magic-link / confirmation callback
│   │   ├── chat/[bookId]/   # Main book chat experience
│   │   ├── clubs/           # Book clubs & room pages
│   │   ├── login/           # Sign in, sign up & guest ID management
│   │   └── notes/           # Saved notes page
│   ├── components/          # UI components (auth, chat, clubs, landing, notes, settings, admin)
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── ai/              # Prompts, persona/muse logic, embeddings
│   │   ├── db/              # Supabase browser/server clients & auth helpers
│   │   ├── ingest/          # Parsing, chunking, and saving books
│   │   ├── rag/             # Query rewriting, retrieval, and validation
│   │   ├── catalog.ts       # Static catalog & book types
│   │   ├── guestLimit.ts    # Guest usage quota tracking
│   │   └── userHistory.ts   # Local guest chat persistence
│   └── middleware.ts        # Supabase session cookie refresh middleware
└── supabase/migrations/     # SQL schema, pgvector, auth RLS, and social/club tables
```

---

## Getting Started

### 1. Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com/) project with `pgvector` enabled
- An [Anthropic](https://www.anthropic.com/) API key
- A [Voyage AI](https://www.voyageai.com/) or [OpenAI](https://openai.com/) API key for embeddings

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Key variables in `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL`
- `EMBEDDING_PROVIDER` (`voyage` or `openai`), `VOYAGE_API_KEY`, `VOYAGE_EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`
- `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL` *(optional if using OpenAI embeddings)*
- `GUEST_CHAT_LIMIT` *(optional, defaults to `5` per 24 hours)*

### 4. Apply Database Migrations

Run the SQL migrations in `supabase/migrations/` in order against your Supabase database:

1. `0001_initial_schema.sql`
2. `0002_book_slug.sql`
3. `0003_book_acquisition.sql`
4. `0004_auth_rls.sql`
5. `0005_phase3_social.sql`

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the production application |
| `npm run start` | Start the production server |
| `npm run lint` | Run Next.js ESLint checks |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run ingest` | Run book ingestion (`tsx scripts/ingest.ts`) |
| `npm run eval` | Run RAG evaluations (`tsx scripts/eval.ts`) |
