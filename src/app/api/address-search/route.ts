import { NextResponse, type NextRequest } from "next/server";

// Address search for "Searching near…".
//   GET /api/address-search?q=123 main st&lat=..&lng=..&session=uuid  -> { suggestions: [...] }
//   GET /api/address-search?placeId=...&session=uuid                    -> { lat, lng, label }
// Uses Google Places Autocomplete (New) when GOOGLE_PLACES_API_KEY is set (same key/API as the locator),
// otherwise OpenStreetMap Nominatim. The session token groups typing + the final pick into one billed session.

export type Suggestion = { id: string; main: string; secondary: string; lat?: number; lng?: number };

const UA = "HealthHere/0.1 (mobile web health locator)";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const session = (sp.get("session") ?? "").slice(0, 64);
  const lang = sp.get("lang") ?? "en";

  try {
    // ---- resolve a picked suggestion to coordinates ----
    const placeId = sp.get("placeId");
    if (placeId) {
      if (!key || !/^[\w-]{10,300}$/.test(placeId)) return NextResponse.json({ error: "bad request" }, { status: 400 });
      const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}${session ? `?sessionToken=${encodeURIComponent(session)}` : ""}`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location,formattedAddress,shortFormattedAddress", "Accept-Language": lang },
      });
      if (!r.ok) throw new Error(`details ${r.status}`);
      const d = (await r.json()) as { location: { latitude: number; longitude: number }; formattedAddress?: string; shortFormattedAddress?: string };
      return NextResponse.json({
        lat: d.location.latitude,
        lng: d.location.longitude,
        label: (d.formattedAddress ?? d.shortFormattedAddress ?? "").replace(/, USA$/, ""),
      });
    }

    // ---- suggestions while typing ----
    const q = (sp.get("q") ?? "").trim().slice(0, 120);
    if (q.length < 3) return NextResponse.json({ suggestions: [] });
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    const near = Number.isFinite(lat) && Number.isFinite(lng) && sp.get("lat") !== null;

    if (key) {
      const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({
          input: q,
          includedRegionCodes: ["us"],
          languageCode: lang,
          ...(session ? { sessionToken: session } : {}),
          ...(near ? { locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } } } : {}),
        }),
      });
      if (!r.ok) throw new Error(`autocomplete ${r.status}`);
      const d = (await r.json()) as {
        suggestions?: { placePrediction?: { placeId: string; text?: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }[];
      };
      const suggestions: Suggestion[] = (d.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .slice(0, 6)
        .map((p) => ({
          id: p.placeId,
          main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
          secondary: (p.structuredFormat?.secondaryText?.text ?? "").replace(/, USA$/, ""),
        }));
      return NextResponse.json({ suggestions });
    }

    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&addressdetails=0&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": UA, "Accept-Language": lang },
    });
    const d = (await r.json()) as { place_id: number; lat: string; lon: string; display_name: string }[];
    const suggestions: Suggestion[] = d.map((x) => {
      const parts = x.display_name.split(",").map((s) => s.trim());
      return { id: `osm-${x.place_id}`, main: parts.slice(0, 2).join(", "), secondary: parts.slice(2, 5).join(", "), lat: Number(x.lat), lng: Number(x.lon) };
    });
    return NextResponse.json({ suggestions });
  } catch (e) {
    console.warn("address search failed", (e as Error).message);
    return NextResponse.json({ error: "search unavailable" }, { status: 502 });
  }
}
