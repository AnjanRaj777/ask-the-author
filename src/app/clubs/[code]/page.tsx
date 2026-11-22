import { ClubRoomClient } from "@/components/clubs/ClubRoomClient";

export const metadata = { title: "Book Club Room · Ask the Author" };

export default async function ClubRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main className="min-h-svh bg-paper text-ink">
      <ClubRoomClient code={code} />
    </main>
  );
}
