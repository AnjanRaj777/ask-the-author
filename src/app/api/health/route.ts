import { NextResponse } from "next/server";

export async function GET() {
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
  const hasMuse = Boolean(process.env.MUSE_API_KEY);
  const embeddingProvider = process.env.EMBEDDING_PROVIDER || "voyage";
  const hasEmbeddings =
    embeddingProvider === "voyage"
      ? Boolean(process.env.VOYAGE_API_KEY)
      : Boolean(process.env.OPENAI_API_KEY);

  return NextResponse.json({
    ok: true,
    phase: 2,
    llmModel: process.env.MUSE_MODEL || "muse-wonder-1.0",
    env: {
      supabaseConfigured: hasSupabase,
      museConfigured: hasMuse,
      embeddingProvider,
      embeddingsConfigured: hasEmbeddings,
    },
  });
}
