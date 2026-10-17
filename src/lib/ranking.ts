// "Best match" ranking for the locator. Pure functions — no network.
//
// Each place gets a score from several signals. Weights were chosen so that:
//  • a confirmed insurance match beats a slightly closer place with unknown insurance,
//  • a well-reviewed place (many reviews) beats a perfect 5.0 with only 2 reviews,
//  • distance still matters, just less than "is this the right, good, covered place",
//  • obviously non-medical results (offices, pharmacies, labs, telehealth HQs) sink to the bottom.
import type { Place } from "./types";

export type SortMode = "relevance" | "distance" | "rating";

const INSURANCE_POINTS: Record<Place["insuranceStatus"], number> = {
  accepted: 3, // verified in our own table
  website_listed: 2.5, // named on their insurance page
  unknown: 0,
  website_not_listed: -1.5, // their plan list didn't include it
  not_accepted: -3,
};

// Google place types that mean "a place you can actually go for care".
const CARE_TYPE = /hospital|clinic|doctor|physician|medical_center|urgent_care|emergency|dentist|dental|surgeon|pediatric|cardiolog|dermatolog|orthoped|obstetric|gynecolog|neurolog|psychiatr|ophthalmolog|optometr|otolaryngolog|endocrinolog|physiotherap|chiropract|wellness_center|health/i;
// Types that are usually NOT what someone looking for care wants.
const NOT_CARE_TYPE = /corporate_office|insurance_agency|pharmacy|drugstore|medical_lab|store|consultant|real_estate|school|university|veterinar/i;

/** Rating adjusted for how many reviews back it up (pulls small samples toward 4.0). */
export function trustedRating(p: Pick<Place, "rating" | "ratingCount">) {
  const n = p.ratingCount ?? 0;
  const r = p.rating ?? 4.0;
  const PRIOR = 4.0;
  const WEIGHT = 15; // "worth" of the prior, in reviews
  return (r * n + PRIOR * WEIGHT) / (n + WEIGHT);
}

export function relevanceScore(p: Place) {
  let s = 0;
  s += INSURANCE_POINTS[p.insuranceStatus];
  s += (trustedRating(p) - 4.0) * 2.2; // ≈ -2 … +2
  s += Math.min(Math.log10((p.ratingCount ?? 0) + 1), 3) * 0.25; // well-established places, small bonus
  s += p.openNow === true ? 0.6 : p.openNow === false ? -0.3 : 0;
  s -= Math.max(0, p.distanceKm - 1) * 0.22; // first km is free, then a gentle penalty
  s -= (p.rank ?? 0) * 0.07; // Google's own "how well it matches your search" order
  const types = [p.primaryType ?? "", ...(p.types ?? [])].join(" ");
  if (types.trim()) {
    if (NOT_CARE_TYPE.test(p.primaryType ?? "")) s -= 3;
    else if (!CARE_TYPE.test(types)) s -= 1.5;
  }
  return s;
}

export function sortPlaces(places: Place[], mode: SortMode): Place[] {
  const list = [...places];
  if (mode === "distance") return list.sort((a, b) => a.distanceKm - b.distanceKm);
  if (mode === "rating")
    return list.sort((a, b) => trustedRating(b) - trustedRating(a) || a.distanceKm - b.distanceKm);
  return list.sort((a, b) => relevanceScore(b) - relevanceScore(a) || a.distanceKm - b.distanceKm);
}
