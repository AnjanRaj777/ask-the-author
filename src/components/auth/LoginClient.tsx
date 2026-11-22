"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, LogOut, Mail } from "lucide-react";
import { createSupabaseBrowserAuthClient } from "@/lib/db/supabase";
import {
  getOrCreateUserId,
  loadUserChats,
  setActiveUserId,
  type SavedBookChat,
} from "@/lib/userHistory";

type AuthTab = "signin" | "signup";

export function LoginClient() {
  const router = useRouter();
  const [authTab, setAuthTab] = useState<AuthTab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [inputId, setInputId] = useState("");
  const [chats, setChats] = useState<SavedBookChat[]>([]);

  useEffect(() => {
    const uid = getOrCreateUserId();
    setUserId(uid);
    setInputId(uid);
    const localChats = loadUserChats(uid);
    setChats(localChats);

    const supabase = createSupabaseBrowserAuthClient();
    if (!supabase) return;

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setSignedInEmail(user.email ?? "Signed-in account");

      if (localChats.length > 0) {
        await fetch("/api/auth/migrate-guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chats: localChats }),
        }).catch(() => null);
      }

      const res = await fetch("/api/conversations").catch(() => null);
      if (res?.ok) {
        const data = (await res.json()) as { chats?: SavedBookChat[] };
        if (Array.isArray(data.chats) && data.chats.length > 0) {
          setChats(data.chats);
        }
      }
    });
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const supabase = createSupabaseBrowserAuthClient();
    if (!supabase) {
      setError("Supabase Auth is not configured in .env.local.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setBusy(true);
    try {
      const origin = window.location.origin;
      if (authTab === "signup") {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback`,
          },
        });
        if (signUpErr) throw signUpErr;
        if (data.session) {
          router.push("/#library");
          router.refresh();
          return;
        }
        setNotice(
          "Account created! Check your email for a confirmation link to sign in."
        );
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) throw signInErr;
        router.push("/#library");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleMagicLink = async () => {
    setError(null);
    setNotice(null);
    const supabase = createSupabaseBrowserAuthClient();
    if (!supabase) {
      setError("Supabase Auth is not configured in .env.local.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email address first to receive a sign-in link.");
      return;
    }
    setBusy(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (otpErr) throw otpErr;
      setNotice("Check your email for your magic sign-in link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send link.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    const supabase = createSupabaseBrowserAuthClient();
    if (!supabase) {
      setError("Supabase Auth is not configured in .env.local.");
      return;
    }
    setBusy(true);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    const supabase = createSupabaseBrowserAuthClient();
    if (!supabase) {
      setError("Supabase Auth is not configured in .env.local.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email address above first.");
      return;
    }
    setBusy(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/auth/callback` }
      );
      if (resetErr) throw resetErr;
      setNotice("Password reset link sent to your email.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send reset email."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResendConfirmation = async () => {
    setError(null);
    setNotice(null);
    const supabase = createSupabaseBrowserAuthClient();
    if (!supabase || !email.trim()) return;
    setBusy(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (resendErr) throw resendErr;
      setNotice("Confirmation email resent. Check your inbox (and spam folder).");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resend confirmation email."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserAuthClient();
    if (supabase) await supabase.auth.signOut();
    setSignedInEmail(null);
    setChats(loadUserChats(userId));
    router.refresh();
  };

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputId.trim()) return;
    const next = setActiveUserId(inputId);
    setUserId(next);
    setInputId(next);
    setChats(loadUserChats(next));
  };

  return (
    <div className="relative w-full max-w-md rounded-3xl border border-ink/10 bg-paper/85 p-8 text-center shadow-[0_24px_60px_-20px_rgba(42,34,29,0.45)] backdrop-blur-md">
      <Link href="/" className="font-serif text-2xl font-semibold text-ink">
        Ask the Author
      </Link>

      {signedInEmail ? (
        <>
          <h1 className="mt-5 font-serif text-4xl font-semibold">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Signed in as <span className="font-medium text-ink">{signedInEmail}</span>
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-page/80 px-5 py-2 text-xs font-medium text-ink transition hover:border-leather/40 hover:bg-page"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </>
      ) : (
        <>
          <h1 className="mt-4 font-serif text-4xl font-semibold">
            {authTab === "signin" ? "Welcome back" : "Create account"}
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Sync your conversations and books across devices.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-ink/10 bg-ink/[0.05] p-1">
            <button
              type="button"
              onClick={() => {
                setAuthTab("signin");
                setError(null);
                setNotice(null);
              }}
              className={`rounded-full py-1.5 text-xs font-medium transition ${
                authTab === "signin"
                  ? "bg-page text-ink shadow-xs"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab("signup");
                setError(null);
                setNotice(null);
              }}
              className={`rounded-full py-1.5 text-xs font-medium transition ${
                authTab === "signup"
                  ? "bg-page text-ink shadow-xs"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              Sign up
            </button>
          </div>

          <div className="mt-4 space-y-3 text-left">
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogle}
              className="w-full rounded-full border border-ink/15 bg-page/85 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-page disabled:opacity-60"
            >
              Continue with Google
            </button>

            <div className="flex items-center gap-3 py-0.5 text-[11px] uppercase tracking-[0.2em] text-ink-soft">
              <span className="h-px flex-1 bg-ink/15" />
              or
              <span className="h-px flex-1 bg-ink/15" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-2.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-full border border-ink/15 bg-page/85 px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 focus:border-leather focus:outline-none"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (6+ characters)"
                className="w-full rounded-full border border-ink/15 bg-page/85 px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 focus:border-leather focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-leather disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {authTab === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <div className="flex items-center justify-between px-1 text-xs">
              <button
                type="button"
                disabled={busy}
                onClick={handleMagicLink}
                className="inline-flex items-center gap-1 text-ink-soft underline underline-offset-2 hover:text-ink"
              >
                <Mail className="h-3 w-3" />
                Email magic link
              </button>
              {authTab === "signin" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleForgotPassword}
                  className="text-ink-soft underline underline-offset-2 hover:text-ink"
                >
                  Forgot password?
                </button>
              )}
            </div>
          </div>

          {error && (
            <div
              className="mt-3 rounded-xl border border-red-300 bg-red-50/90 px-3 py-2 text-xs text-red-900"
              role="alert"
            >
              <p>{error}</p>
              {/email not confirmed/i.test(error) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleResendConfirmation}
                  className="mt-1.5 font-medium underline underline-offset-2 hover:opacity-80"
                >
                  Resend confirmation email
                </button>
              )}
            </div>
          )}
          {notice && (
            <p className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-900">
              {notice}
            </p>
          )}
        </>
      )}

      {/* Previous chat books + Guest User ID fallback */}
      <div className="mt-6 border-t border-ink/10 pt-5 text-left">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
          Previous chat books{" "}
          {!signedInEmail && (
            <>
              for <span className="font-mono text-ink">{userId || "…"}</span>
            </>
          )}
        </p>

        {chats.length === 0 ? (
          <p className="mt-2 text-xs text-ink-soft">
            No previous chat books yet.
          </p>
        ) : (
          <ul className="quiet-scroll mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
            {chats.map((chat, idx) => (
              <li key={`${chat.bookId}-${idx}`}>
                <Link
                  href={`/chat/${chat.bookId}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-page/65 px-3.5 py-2.5 transition hover:border-leather/40 hover:bg-page"
                >
                  <div className="min-w-0">
                    <p className="truncate font-serif text-sm font-semibold text-ink">
                      {chat.title}
                    </p>
                    <p className="truncate text-[11px] text-ink-soft">
                      {chat.personaName} · {chat.messages.length}{" "}
                      {chat.messages.length === 1 ? "message" : "messages"}
                    </p>
                  </div>
                  <BookOpen className="h-4 w-4 shrink-0 text-leather" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!signedInEmail && (
          <form onSubmit={handleGuestSubmit} className="mt-4 flex gap-2">
            <input
              id="user-id"
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              placeholder="Guest User ID"
              className="min-w-0 flex-1 rounded-full border border-ink/15 bg-page/85 px-3.5 py-1.5 font-mono text-xs text-ink placeholder:text-ink-soft/70 focus:border-leather focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full border border-ink/15 bg-page px-3.5 py-1.5 text-xs font-medium text-ink transition hover:border-leather/40"
            >
              Switch guest ID
            </button>
          </form>
        )}
      </div>

      <Link
        href="/#library"
        className="mt-5 inline-block text-sm text-ink underline underline-offset-4 hover:text-leather"
      >
        Browse the library
      </Link>
    </div>
  );
}
