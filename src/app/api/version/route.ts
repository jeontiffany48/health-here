import { NextResponse } from "next/server";

// Which version of the app is live (Vercel sets the commit ID). Used by <UpdateCheck>.
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
