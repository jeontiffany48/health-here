import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Google sign-in (and older-style email links) land here with ?code=...
// Email links using the token_hash template go to /auth/confirm instead (works on any device).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const next = sp.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // Some links arrive here with a token_hash — hand them to the confirm page.
  if (sp.get("token_hash")) {
    return NextResponse.redirect(new URL(`/auth/confirm?${sp.toString()}`, req.url));
  }
  // Supabase/Google sent back an error (expired link, cancelled sign-in, …)
  if (sp.get("error") || sp.get("error_description")) {
    return NextResponse.redirect(new URL(`/auth?error=link`, req.url));
  }

  const code = sp.get("code");
  if (code) {
    const sb = await getServerSupabase();
    const { error } = (await sb?.auth.exchangeCodeForSession(code)) ?? { error: null };
    if (error) {
      // e.g. a reset link opened in a different browser than the one that asked for it
      const dest = safeNext === "/auth/reset" ? "/auth/forgot?error=link" : "/auth?error=link";
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }
  return NextResponse.redirect(new URL(safeNext, req.url));
}
