import { ClubsClient } from "@/components/clubs/ClubsClient";

export const metadata = { title: "Book Clubs · Ask the Author" };

export default function ClubsPage() {
  return (
    <main className="min-h-svh bg-paper text-ink">
      <ClubsClient />
    </main>
  );
}
