"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ThumbsDown, ThumbsUp } from "lucide-react";

interface FeedbackItem {
  id: string;
  messageId: string;
  bookTitle: string;
  bookAuthor: string;
  question: string;
  answer: string;
  rating: number;
  reason: string | null;
  createdAt: string;
}

export function FeedbackReviewClient() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<"all" | "1" | "-1">("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (ratingFilter !== "all") params.set("rating", ratingFilter);
    if (reasonFilter !== "all") params.set("reason", reasonFilter);

    fetch(`/api/feedback?${params.toString()}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          items?: FeedbackItem[];
          error?: string;
        };
        if (!res.ok) {
          setError(data.error || "Unable to load feedback.");
        } else {
          setItems(data.items ?? []);
          setError(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to fetch feedback.");
        setLoading(false);
      });
  }, [ratingFilter, reasonFilter]);

  const upCount = items.filter((i) => i.rating === 1).length;
  const downCount = items.filter((i) => i.rating === -1).length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/#library"
            className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Library
          </Link>
          <div>
            <h1 className="font-display text-2xl font-medium text-ink">
              Feedback Review
            </h1>
            <p className="text-xs text-ink-muted">
              Admin quality review for 👍 / 👎 answer ratings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface px-3 py-1 text-emerald-700">
            <ThumbsUp className="h-3.5 w-3.5" /> {upCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface px-3 py-1 text-rose-700">
            <ThumbsDown className="h-3.5 w-3.5" /> {downCount}
          </span>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value as "all" | "1" | "-1")}
          className="rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs text-ink"
        >
          <option value="all">All ratings</option>
          <option value="-1">👎 Negative only</option>
          <option value="1">👍 Positive only</option>
        </select>

        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs text-ink"
        >
          <option value="all">All reasons</option>
          <option value="wrong">Wrong / inaccurate</option>
          <option value="spoiler">Spoiler leak</option>
          <option value="bad_citation">Bad citation</option>
          <option value="off_voice">Off voice</option>
          <option value="other">Other</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading feedback…</p>
      ) : error ? (
        <div className="rounded-xl border border-edge bg-surface p-6 text-center">
          <p className="text-sm text-ink">{error}</p>
          <Link
            href="/login?next=/admin/feedback"
            className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white"
          >
            Sign in
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-edge bg-surface p-8 text-center text-sm text-ink-muted">
          No feedback entries match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-edge bg-surface p-5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.rating === 1 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <ThumbsUp className="h-3 w-3" /> Helpful
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                      <ThumbsDown className="h-3 w-3" /> Issue
                    </span>
                  )}
                  {item.reason && (
                    <span className="rounded border border-edge bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                      {item.reason}
                    </span>
                  )}
                  <span className="text-xs font-medium text-ink">
                    {item.bookTitle}
                  </span>
                </div>
                <span className="text-[11px] text-ink-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>

              {item.question && (
                <p className="mb-1.5 text-xs font-semibold text-ink">
                  Q: {item.question}
                </p>
              )}
              {item.answer && (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-muted">
                  {item.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
