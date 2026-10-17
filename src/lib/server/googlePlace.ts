import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/client";
import { distanceKm, directionsUrl } from "@/lib/geo";
import type { InsuranceStatus, Period, Place, PlaceKind } from "@/lib/types";

// Shared by /api/places (search) and /api/place-details (saved places).

export const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "currentOpeningHours",
  "regularOpeningHours",
  "nationalPhoneNumber",
  "websiteUri",
  "primaryTypeDisplayName",
  "primaryType",
  "types",
  "businessStatus",
  "utcOffsetMinutes",
];

export type GPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[]; periods?: Period[] };
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[]; periods?: Period[] };
  utcOffsetMinutes?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text: string };
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
};

const pick = (x: Period["open"]) => ({ day: x.day, hour: x.hour, minute: x.minute });

/** Google place → the app's Place. */
export function toPlace(g: GPlace, kind: PlaceKind, center: { lat: number; lng: number }, jsDow: number, i = 0): Place {
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
    periods: hours?.periods?.length ? hours.periods.map((p) => ({ open: pick(p.open), ...(p.close ? { close: pick(p.close) } : {}) })) : null,
    utcOffsetMinutes: g.utcOffsetMinutes ?? null,
  };
}

/** Fill in accepted plans from our own provider_insurance table (null = no data). */
export async function attachInsurance(places: Place[]) {
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
