import { NotesClient } from "@/components/notes/NotesClient";

export const metadata = { title: "Saved Notes · Ask the Author" };

export default function NotesPage() {
  return (
    <main className="min-h-svh bg-paper text-ink">
      <NotesClient />
    </main>
  );
}
