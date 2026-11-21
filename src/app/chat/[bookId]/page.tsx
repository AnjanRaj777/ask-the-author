import { notFound } from "next/navigation";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { getCatalogBook, toChatBook, type ChatBook } from "@/lib/catalog";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ChatPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;

  if (bookId === "upload") return <ChatScreen book={null} />;

  if (UUID_RE.test(bookId)) {
    const supabase = getSupabaseServerClient();
    const [{ data: bookRow }, { data: personaRow }] = await Promise.all([
      supabase
        .from("books")
        .select("id, title, author, chapter_count, source, status")
        .eq("id", bookId)
        .maybeSingle(),
      supabase
        .from("personas")
        .select("display_name, starter_questions")
        .eq("book_id", bookId)
        .maybeSingle(),
    ]);

    if (!bookRow || bookRow.status !== "ready") notFound();

    const rawDisplayName = (personaRow?.display_name as string) || "";
    const hasAuthor =
      Boolean(bookRow.author) &&
      !/^unknown author$/i.test((bookRow.author as string).trim());
    const personaName =
      rawDisplayName && rawDisplayName !== "Book Guide"
        ? rawDisplayName
        : hasAuthor
          ? (bookRow.author as string)
          : "The Author";

    const chatBook: ChatBook = {
      kind: bookRow.source === "upload" ? "upload" : "library",
      id: bookRow.id as string,
      title: bookRow.title as string,
      author: bookRow.author as string,
      personaName,
      chapterCount: bookRow.chapter_count ? (bookRow.chapter_count as number) : null,
      chapterLabel: "Chapter",
      greeting: "What would you like to explore in this book?",
      starterQuestions: Array.isArray(personaRow?.starter_questions)
        ? (personaRow.starter_questions as string[])
        : [],
    };
    return <ChatScreen book={chatBook} />;
  }

  const book = getCatalogBook(bookId);
  if (!book || !book.available) notFound();

  return <ChatScreen book={toChatBook(book)} />;
}
