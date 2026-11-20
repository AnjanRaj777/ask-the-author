import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-6 text-center">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-ink-soft">
          404
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          That chapter doesn&apos;t seem to be in this volume.
        </p>
        <Link
          href="/#library"
          className="mt-6 inline-block rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-paper transition hover:bg-leather"
        >
          Back to library
        </Link>
      </div>
    </main>
  );
}
