import { NextResponse, type NextRequest } from "next/server";

// GET /api/place-photo?name=places/XXX/photos/YYY&w=160
// Looks up a Google Places photo with the server-side key and redirects the browser to the image,
// so the API key is never exposed. Google requires showing the photo's author attribution (PlaceCard does).
const NAME = /^places\/[A-Za-z0-9_-]{5,200}\/photos\/[A-Za-z0-9_-]{5,600}$/;

export async function GET(req: NextRequest) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const w = Math.min(400, Math.max(64, Number(req.nextUrl.searchParams.get("w")) || 160));
  if (!key || !NAME.test(name)) return new NextResponse(null, { status: 404 });
  try {
    const r = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${key}`);
    if (!r.ok) return new NextResponse(null, { status: 404 });
    const { photoUri } = (await r.json()) as { photoUri?: string };
    if (!photoUri || !/^https:\/\/[a-z0-9.-]+\.(googleusercontent|ggpht|google)\.com\//.test(photoUri)) return new NextResponse(null, { status: 404 });
    // Short cache: fewer paid lookups when people scroll back and forth, without storing Google content long-term.
    return NextResponse.redirect(photoUri, { status: 302, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
