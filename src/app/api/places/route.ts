import { NextResponse, type NextRequest } from "next/server";
import { distanceKm, directionsUrl } from "@/lib/geo";
import { samplePlaces, type RawPlace } from "@/lib/sampleData";
import type { Place, PlaceKind, PlacesResponse } from "@/lib/types";
import { PLACE_FIELDS, attachInsurance, toPlace, type GPlace } from "@/lib/server/googlePlace";
import { insuranceStatusFor } from "@/lib/insuranceMatch";
import { getCachedScans } from "@/lib/server/websiteScanner";

// GET /api/places?kind=facility|doctor|er&q=cardiologist&lat=..&lng=..&insurance=aetna&dow=0-6&mins=minutesSinceMidnight
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = (sp.get("kind") ?? "facility") as PlaceKind;
  const q = (sp.get("q") ?? "").slice(0, 80);
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const insurance = sp.get("insurance") ?? "";
  const dow = Number(sp.get("dow") ?? new Date().getDay()); // 0 = Sunday (user's local)
  const mins = Number(sp.get("mins") ?? 12 * 60); // user's local time of day
  if (!["facility", "doctor", "er"].includes(kind) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const center = { lat, lng };
  const key = process.env.GOOGLE_PLACES_API_KEY;

  try {
    let places: Place[];
    let source: PlacesResponse["source"];
    if (key) {
      places = await fromGoogle(key, kind, q, center, dow);
      source = "google";
      await attachInsurance(places);
      const scans = await getCachedScans(places.filter((p) => p.website).map((p) => p.id)).catch(() => new Map());
      for (const p of places) p.websiteScan = scans.get(p.id) ?? null;
    } else {
      places = samplePlaces(kind, q, center).map((p, i) => fromSample(p, center, dow, mins, i));
      source = "sample";
    }
    for (const p of places) p.insuranceStatus = insuranceStatusFor(p, insurance);
    // Keep the provider's relevance order (rank); the app ranks "Best match" itself (see lib/ranking.ts).
    return NextResponse.json({ places, source } satisfies PlacesResponse, {
      headers: { "Cache-Control": "private, max-age=120" },
    });
  } catch (e) {
    console.error("places error", e);
    return NextResponse.json({ error: "Could not load places" }, { status: 502 });
  }
}

// ---------- Sample data ----------
const fmtHour = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function fromSample(p: RawPlace, center: { lat: number; lng: number }, dow: number, mins: number, rank: number): Place {
  const monIdx = (dow + 6) % 7; // convert Sunday-based to Monday-based
  let openNow: boolean | null = null;
  let todayHours: string | null = null;
  let weekHours: string[] = [];
  if (p.weekHours === "24h") {
    openNow = true;
    todayHours = "Open 24 hours";
    weekHours = DAYS.map((d) => `${d}: Open 24 hours`);
  } else if (p.weekHours) {
    const [o, c] = p.weekHours[monIdx];
    openNow = o !== c && mins >= o * 60 && mins < c * 60;
    todayHours = o === c ? "Closed" : `${fmtHour(o)} – ${fmtHour(c)}`;
    weekHours = p.weekHours.map(([a, b], i) => `${DAYS[i]}: ${a === b ? "Closed" : `${fmtHour(a)} – ${fmtHour(b)}`}`);
  }
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    location: p.location,
    distanceKm: distanceKm(center, p.location),
    rating: p.rating,
    ratingCount: p.ratingCount,
    openNow,
    todayHours,
    weekHours,
    phone: p.phone,
    mapsUrl: directionsUrl(p.location),
    category: p.category,
    acceptedInsurance: p.acceptedInsurance,
    website: null,
    websiteScan: null,
    insuranceStatus: "unknown",
    rank,
    primaryType: null,
    types: [],
    periods:
      p.weekHours === "24h"
        ? [{ open: { day: 0, hour: 0, minute: 0 } }]
        : p.weekHours
          ? p.weekHours.flatMap(([o, c], i) => (o === c ? [] : [{ open: { day: (i + 1) % 7, hour: o, minute: 0 }, close: { day: (i + 1) % 7, hour: c, minute: 0 } }]))
          : null,
    utcOffsetMinutes: null,
  };
}

// ---------- Google Places API (New) ----------
async function fromGoogle(key: string, kind: PlaceKind, q: string, center: { lat: number; lng: number }, jsDow: number): Promise<Place[]> {
  const textQuery =
    kind === "er" ? "hospital emergency room" : kind === "doctor" ? q || "primary care doctor" : "hospital or medical clinic or urgent care";
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": PLACE_FIELDS.map((f) => `places.${f}`).join(","),
    },
    body: JSON.stringify({
      textQuery,
      pageSize: 20,
      locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 15000 } },
      ...(kind === "er" ? { includedType: "hospital" } : {}),
    }),
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { places?: GPlace[] };

  return (data.places ?? [])
    .filter((g) => g.location && g.businessStatus !== "CLOSED_PERMANENTLY" && g.businessStatus !== "CLOSED_TEMPORARILY")
    .map((g, i) => toPlace(g, kind, center, jsDow, i))
    .filter((p) => p.distanceKm < 40);
}
