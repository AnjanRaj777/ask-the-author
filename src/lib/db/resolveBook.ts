import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveBookRow(
  supabase: SupabaseClient,
  bookKey: string
): Promise<{
  id: string;
  slug: string | null;
  title: string;
  author: string;
  chapter_count: number;
  persona_mode: string;
  source: string;
  status: string;
} | null> {
  const key = bookKey.trim();
  if (!key) return null;
  const query = supabase
    .from("books")
    .select("id, slug, title, author, chapter_count, persona_mode, source, status")
    .limit(1);

  const { data } = UUID_RE.test(key)
    ? await query.eq("id", key).maybeSingle()
    : await query.eq("slug", key).maybeSingle();

  return data ?? null;
}
