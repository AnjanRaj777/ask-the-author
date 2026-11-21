export type BookSource = "public_domain" | "upload" | "text_paste" | "no_file";
export type BookStatus = "pending" | "parsing" | "embedding" | "ready" | "failed";
export type PersonaMode = "author" | "guide";
export type AnswerMode = "grounded" | "speculation" | "not_in_book" | "memory";

export interface Book {
  id: string;
  owner_id: string | null;
  title: string;
  author: string;
  source: BookSource;
  rights_note: string | null;
  language: string;
  cover_url: string | null;
  status: BookStatus;
  chapter_count: number;
  persona_mode: PersonaMode;
  created_at: string;
}

export interface Chapter {
  id: string;
  book_id: string;
  idx: number;
  title: string | null;
  start_page: number | null;
  summary: string | null;
}

export interface Persona {
  book_id: string;
  display_name: string;
  voice_notes: string | null;
  themes: string[];
  bio_facts: string | null;
  style_samples: string[];
  starter_questions: string[];
}

export interface Citation {
  n: number;
  chunkId: string;
  chapterIdx: number;
  chapterTitle: string | null;
  page: number | null;
  quote: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  answer_mode?: AnswerMode;
  citations?: Citation[];
  created_at: string;
}
