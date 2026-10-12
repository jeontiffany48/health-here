import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Email confirmation, Google sign-in and password-reset links land here.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (code) {
    const sb = await getServerSupabase();
    await sb?.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(safeNext, req.url));
}
