import { FeedbackReviewClient } from "@/components/admin/FeedbackReviewClient";

export const metadata = { title: "Feedback Review · Ask the Author" };

export default function AdminFeedbackPage() {
  return (
    <main className="min-h-svh bg-paper text-ink">
      <FeedbackReviewClient />
    </main>
  );
}
