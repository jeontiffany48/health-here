import { NextResponse, type NextRequest } from "next/server";

// Free geocoding via OpenStreetMap Nominatim (light use only — see their usage policy).
// GET /api/geocode?q=Austin TX       -> { lat, lng, label }
// GET /api/geocode?lat=..&lng=..     -> { label }  (street address for the 911 screen)
const UA = "HealthHere/0.1 (mobile web health locator)";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  const lang = sp.get("lang") ?? "en";
  try {
    if (q) {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(q.slice(0, 100))}`,
        { headers: { "User-Agent": UA, "Accept-Language": lang } },
      );
      const data = (await r.json()) as { lat: string; lon: string; display_name: string }[];
      if (!data[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json({
        lat: Number(data[0].lat),
        lng: Number(data[0].lon),
        label: data[0].display_name.split(",").slice(0, 3).join(",").trim(),
      });
    }
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "bad request" }, { status: 400 });
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      headers: { "User-Agent": UA, "Accept-Language": lang },
    });
    const data = (await r.json()) as { display_name?: string };
    return NextResponse.json({ label: data.display_name?.split(",").slice(0, 4).join(",").trim() ?? null });
  } catch {
    return NextResponse.json({ error: "geocoding unavailable" }, { status: 502 });
  }
}
