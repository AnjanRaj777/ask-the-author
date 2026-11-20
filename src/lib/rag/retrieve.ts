import { embedTexts } from "@/lib/ai/embeddings";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export interface RetrievedChunk {
  id: string;
  book_id: string;
  chapter_idx: number;
  chapter_title: string | null;
  seq: number;
  page: number | null;
  content: string;
  score: number;
}

/**
 * Hybrid (vector + full-text RRF) retrieval filtered at the SQL level
 * to chapters <= spoilerLimit.
 */
export async function retrieveChunks(params: {
  bookId: string;
  question: string;
  spoilerLimit: number;
  matchCount?: number;
}): Promise<RetrievedChunk[]> {
  const { bookId, question, spoilerLimit, matchCount = 8 } = params;
  const [queryEmbedding] = await embedTexts([question], "query");

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("match_book_chunks", {
    p_book_id: bookId,
    p_spoiler_limit: spoilerLimit,
    p_query_text: question,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
  });

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  const rows = (data ?? []) as RetrievedChunk[];
  // Defense-in-depth spoiler guard in case RPC was misconfigured
  return rows.filter((r) => r.chapter_idx <= spoilerLimit);
}
