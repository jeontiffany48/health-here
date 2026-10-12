import type { LatLng } from "./types";

export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** U.S. users read miles; everything else gets km. */
export function formatDistance(km: number, lang: string) {
  if (lang === "en" || lang === "es") {
    const mi = km * 0.621371;
    return mi < 0.1 ? "<0.1 mi" : `${mi.toFixed(1)} mi`;
  }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Opens Google Maps directions (app on phones, website on desktop). */
export function directionsUrl(to: LatLng, googlePlaceId?: string) {
  const base = `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}`;
  return googlePlaceId ? `${base}&destination_place_id=${encodeURIComponent(googlePlaceId)}` : base;
}

/** Short accuracy text: feet/miles for en & es, meters/km otherwise. */
export function formatAccuracy(m: number, lang: string) {
  if (lang === "en" || lang === "es") {
    const ft = m * 3.28084;
    return ft < 1000 ? `${Math.max(10, Math.round(ft / 10) * 10)} ft` : `${(m / 1609.34).toFixed(m < 16093 ? 1 : 0)} mi`;
  }
  return m < 1000 ? `${Math.max(5, Math.round(m / 5) * 5)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}
