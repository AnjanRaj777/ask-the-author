import Link from "next/link";

export const metadata = { title: "Sign in · Ask the Author" };

export default function LoginPage() {
  return (
    <main
      className="relative grid min-h-svh place-items-center bg-cover bg-center px-6 py-12"
      style={{ backgroundImage: "url('/images/hero-bg.jpg')" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-paper/35" />

      <div className="relative w-full max-w-sm rounded-3xl border border-ink/10 bg-paper/85 p-8 text-center shadow-[0_24px_60px_-20px_rgba(42,34,29,0.45)] backdrop-blur-md">
        <Link href="/" className="font-serif text-2xl font-semibold text-ink">
          Ask the Author
        </Link>
        <h1 className="mt-6 font-serif text-5xl font-semibold">Welcome</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sign in to save your conversations and notes.
        </p>

        <div className="mt-7 space-y-3 text-left">
          <button
            type="button"
            disabled
            className="w-full rounded-full border border-ink/15 bg-white/80 px-4 py-2.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with Google
          </button>
          <div className="flex items-center gap-3 py-1 text-[11px] uppercase tracking-[0.2em] text-ink-soft">
            <span className="h-px flex-1 bg-ink/15" />
            or
            <span className="h-px flex-1 bg-ink/15" />
          </div>
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            type="email"
            disabled
            placeholder="you@example.com"
            className="w-full rounded-full border border-ink/15 bg-white/80 px-4 py-2.5 text-sm placeholder:text-ink-soft/70 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            disabled
            className="w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            Email me a sign-in link
          </button>
        </div>

        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900">
          Accounts are coming in Phase 3. Until then you can explore without
          signing in.
        </p>

        <Link
          href="/#library"
          className="mt-5 inline-block text-sm text-ink underline underline-offset-4 hover:text-leather"
        >
          Continue without an account
        </Link>
      </div>
    </main>
  );
}
