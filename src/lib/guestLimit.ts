import type { NextRequest, NextResponse } from "next/server";

export const GUEST_COOKIE_NAME = "ata_guest_usage";
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getGuestLimit(): number {
  const parsed = Number(process.env.GUEST_CHAT_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 5;
}

interface QuotaBucket {
  count: number;
  resetAt: number;
}

const ipBuckets = new Map<string, QuotaBucket>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function readCookieBucket(req: NextRequest, now: number): QuotaBucket {
  const raw = req.cookies.get(GUEST_COOKIE_NAME)?.value;
  if (!raw) return { count: 0, resetAt: now + WINDOW_MS };
  try {
    const parsed = JSON.parse(raw) as Partial<QuotaBucket>;
    if (
      typeof parsed.count === "number" &&
      typeof parsed.resetAt === "number" &&
      parsed.resetAt > now
    ) {
      return { count: parsed.count, resetAt: parsed.resetAt };
    }
  } catch {
    // ignore malformed cookie
  }
  return { count: 0, resetAt: now + WINDOW_MS };
}

export function checkAndConsumeGuestQuota(req: NextRequest): {
  allowed: boolean;
  limit: number;
  remaining: number;
  nextCount: number;
  resetAt: number;
} {
  const now = Date.now();
  const limit = getGuestLimit();
  const ip = getClientIp(req);

  const cookieBucket = readCookieBucket(req, now);
  let ipBucket = ipBuckets.get(ip);
  if (!ipBucket || ipBucket.resetAt <= now) {
    ipBucket = { count: 0, resetAt: now + WINDOW_MS };
  }

  const effectiveCount = Math.max(cookieBucket.count, ipBucket.count);
  const resetAt = Math.max(cookieBucket.resetAt, ipBucket.resetAt);

  if (effectiveCount >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      nextCount: effectiveCount,
      resetAt,
    };
  }

  const nextCount = effectiveCount + 1;
  ipBuckets.set(ip, { count: nextCount, resetAt });

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - nextCount),
    nextCount,
    resetAt,
  };
}

export function attachGuestQuotaCookie(
  res: NextResponse | Response,
  nextCount: number,
  resetAt: number
) {
  if ("cookies" in res && typeof res.cookies?.set === "function") {
    res.cookies.set(GUEST_COOKIE_NAME, JSON.stringify({ count: nextCount, resetAt }), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(60, Math.floor((resetAt - Date.now()) / 1000)),
    });
  }
}
