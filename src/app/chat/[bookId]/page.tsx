import { notFound } from "next/navigation";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { getCatalogBook, toChatBook } from "@/lib/catalog";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;

  // Uploaded books are read client-side from sessionStorage (Phase 2 moves this to Supabase).
  if (bookId === "upload") return <ChatScreen book={null} />;

  const book = getCatalogBook(bookId);
  if (!book || !book.available) notFound();

  return <ChatScreen book={toChatBook(book)} />;
}
