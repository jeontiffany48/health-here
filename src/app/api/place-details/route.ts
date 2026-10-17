import { NextResponse, type NextRequest } from "next/server";
import { PLACE_FIELDS, attachInsurance, toPlace, type GPlace } from "@/lib/server/googlePlace";
import { insuranceStatusFor } from "@/lib/insuranceMatch";
import { getCachedScans } from "@/lib/server/websiteScanner";
import type { Place, PlaceKind } from "@/lib/types";

// GET /api/place-details?ids=kind:placeId,kind:placeId&lat=..&lng=..&insurance=aetna&dow=0-6
// Fresh details for the user's saved places. We only store Google place IDs (allowed indefinitely
// by Google's terms) and look up the current name, hours and phone number when the list is opened.
const ID = /^[A-Za-z0-9_-]{10,300}$/;
const MAX = 30;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const center = Number.isFinite(lat) && Number.isFinite(lng) && sp.get("lat") ? { lat, lng } : null;
  const dow = Number(sp.get("dow") ?? new Date().getDay());
  const insurance = sp.get("insurance") ?? "";
  const wanted = (sp.get("ids") ?? "")
    .split(",")
    .map((x) => x.split(":"))
    .filter(([k, id]) => ["facility", "doctor", "er"].includes(k) && ID.test(id ?? ""))
    .slice(0, MAX) as [PlaceKind, string][];

  if (!key || wanted.length === 0) return NextResponse.json({ places: [] });

  const results = await Promise.all(
    wanted.map(async ([kind, id]) => {
      try {
        const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
          headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": PLACE_FIELDS.join(",") },
          next: { revalidate: 3600 },
        });
        if (!r.ok) return null;
        const g = (await r.json()) as GPlace;
        if (!g.location) return null;
        const p = toPlace(g, kind, center ?? { lat: g.location.latitude, lng: g.location.longitude }, dow);
        if (!center) p.distanceKm = NaN; // unknown — the card hides the distance
        return p;
      } catch {
        return null;
      }
    }),
  );
  const places = results.filter((p): p is Place => Boolean(p));
  await attachInsurance(places).catch(() => {});
  const scans = await getCachedScans(places.filter((p) => p.website).map((p) => p.id)).catch(() => new Map());
  for (const p of places) {
    p.websiteScan = scans.get(p.id) ?? null;
    p.insuranceStatus = insuranceStatusFor(p, insurance);
  }
  return NextResponse.json({ places }, { headers: { "Cache-Control": "private, max-age=300" } });
}
