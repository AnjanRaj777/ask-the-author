import type { AnswerMode, Citation } from "@/lib/types";
import type { RetrievedChunk } from "@/lib/rag/retrieve";

const CITATION_RE = /\[(\d+)\]/g;

/**
 * Validate `[n]` citations in the generated answer against the retrieved chunks.
 * - Drops any `[n]` that does not correspond to a retrieved chunk or violates spoilerLimit.
 * - Downgrades `grounded` to `speculation` if zero valid citations remain.
 */
export function validateAnswer(params: {
  rawAnswer: string;
  mode: AnswerMode;
  chunks: RetrievedChunk[];
  spoilerLimit: number;
}): {
  answer: string;
  mode: AnswerMode;
  citations: Citation[];
} {
  const { rawAnswer, chunks, spoilerLimit } = params;
  let mode = params.mode;

  const citedIndices = new Set<number>();
  const cleanedAnswer = rawAnswer.replace(CITATION_RE, (match, numStr) => {
    const n = Number(numStr);
    const chunk = chunks[n - 1];
    if (!chunk || chunk.chapter_idx > spoilerLimit) {
      return "";
    }
    citedIndices.add(n);
    return match;
  });

  const citations: Citation[] = [...citedIndices]
    .sort((a, b) => a - b)
    .map((n) => {
      const chunk = chunks[n - 1];
      const preview =
        chunk.content.length > 260
          ? `${chunk.content.slice(0, 257).trimEnd()}…`
          : chunk.content;
      return {
        n,
        chunkId: chunk.id,
        chapterIdx: chunk.chapter_idx,
        chapterTitle: chunk.chapter_title,
        page: chunk.page,
        quote: preview,
      };
    });

  if (mode === "grounded" && citations.length === 0) {
    mode = "speculation";
  }

  return {
    answer: cleanedAnswer.replace(/\s{2,}/g, " ").trim(),
    mode,
    citations,
  };
}
