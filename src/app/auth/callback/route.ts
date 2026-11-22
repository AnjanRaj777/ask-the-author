import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/db/auth";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/#library";

  if (code) {
    const supabase = await createSupabaseServerAuthClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const safeNext = next.startsWith("/") ? next : "/#library";
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
