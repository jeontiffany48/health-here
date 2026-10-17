import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/client";
import { distanceKm, directionsUrl } from "@/lib/geo";
import { samplePlaces, type RawPlace } from "@/lib/sampleData";
import type { InsuranceStatus, Place, PlaceKind, PlacesResponse } from "@/lib/types";
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
  };
}

// ---------- Google Places API (New) ----------
type GPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text: string };
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
};

async function fromGoogle(key: string, kind: PlaceKind, q: string, center: { lat: number; lng: number }, jsDow: number): Promise<Place[]> {
  const textQuery =
    kind === "er" ? "hospital emergency room" : kind === "doctor" ? q || "primary care doctor" : "hospital or medical clinic or urgent care";
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.shortFormattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.currentOpeningHours",
        "places.regularOpeningHours",
        "places.nationalPhoneNumber",
        "places.websiteUri",
        "places.primaryTypeDisplayName",
        "places.primaryType",
        "places.types",
        "places.businessStatus",
      ].join(","),
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
    .map((g, i) => {
      const loc = { lat: g.location!.latitude, lng: g.location!.longitude };
      const hours = g.currentOpeningHours ?? g.regularOpeningHours;
      const week = hours?.weekdayDescriptions ?? [];
      const today = week[(jsDow + 6) % 7];
      return {
        id: g.id,
        name: g.displayName?.text ?? "Unnamed",
        address: g.shortFormattedAddress ?? g.formattedAddress ?? "",
        location: loc,
        distanceKm: distanceKm(center, loc),
        rating: g.rating ?? null,
        ratingCount: g.userRatingCount ?? null,
        openNow: hours?.openNow ?? null,
        todayHours: today ? today.replace(/^[^:]+:\s*/, "") : null,
        weekHours: week,
        phone: g.nationalPhoneNumber ?? null,
        mapsUrl: directionsUrl(loc, g.id),
        category: g.primaryTypeDisplayName?.text ?? (kind === "er" ? "Hospital" : ""),
        acceptedInsurance: null,
        website: g.websiteUri ?? null,
        websiteScan: null,
        insuranceStatus: "unknown" as InsuranceStatus,
        rank: i,
        primaryType: g.primaryType ?? null,
        types: g.types ?? [],
      };
    })
    .filter((p) => p.distanceKm < 40);
}

/** Fill in accepted plans from our own provider_insurance table (null = no data). */
async function attachInsurance(places: Place[]) {
  const url = SUPABASE_URL || undefined;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon || places.length === 0) return;
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("provider_insurance")
    .select("place_id, insurance_id")
    .in("place_id", places.map((p) => p.id));
  if (error || !data) return;
  const map = new Map<string, string[]>();
  for (const r of data) map.set(r.place_id, [...(map.get(r.place_id) ?? []), r.insurance_id]);
  for (const p of places) p.acceptedInsurance = map.get(p.id) ?? null;
}
