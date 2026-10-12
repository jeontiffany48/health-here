import { NextResponse, type NextRequest } from "next/server";
import { scanWebsite } from "@/lib/server/websiteScanner";

export const runtime = "nodejs";
export const maxDuration = 30;

// Simple per-IP limit so nobody can use this endpoint to hammer other websites.
const hits = new Map<string, { n: number; reset: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 60_000 });
    return false;
  }
  h.n++;
  return h.n > 40;
}

// GET /api/insurance-scan?placeId=...&website=https://...
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId") ?? "";
  const website = req.nextUrl.searchParams.get("website") ?? "";
  if (!placeId || placeId.length > 300 || !/^https?:\/\//i.test(website) || website.length > 500) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "slow down" }, { status: 429 });
  try {
    const scan = await scanWebsite(placeId, website);
    return NextResponse.json(scan, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    console.warn("insurance scan failed", website, (e as Error).message);
    return NextResponse.json({ error: "could not read website" }, { status: 502 });
  }
}
