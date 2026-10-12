export type Lang = "en" | "es" | "ko";

export type LatLng = { lat: number; lng: number };

export type Profile = {
  fullName: string;
  insurance: string; // insurance plan id from INSURANCE_PLANS ("none" = uninsured / self-pay)
  language: Lang;
  locationMode: "device" | "manual";
  manualLocation: (LatLng & { label: string }) | null;
  largeText: boolean;
  highContrast: boolean;
  onboarded: boolean;
};

export const DEFAULT_PROFILE: Profile = {
  fullName: "",
  insurance: "",
  language: "en",
  locationMode: "device",
  manualLocation: null,
  largeText: false,
  highContrast: false,
  onboarded: false,
};

export type PlaceKind = "facility" | "doctor" | "er";

/**
 * Insurance status for the user's plan at a place.
 * accepted / not_accepted   = verified in our provider_insurance table
 * website_listed            = the plan is named on the place's own insurance/billing page
 * website_not_listed        = we found their insurance page but the plan wasn't on it
 * unknown                   = no data
 */
export type InsuranceStatus = "accepted" | "not_accepted" | "website_listed" | "website_not_listed" | "unknown";

/** Result of reading a place's website for insurance names. */
export type WebsiteScan = {
  plans: string[]; // plan ids found
  foundInsurancePage: boolean; // did we find a page that talks about insurance at all?
  sourceUrl: string | null; // page where plans were found (shown to the user)
  checkedAt: string;
};

export type Place = {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  distanceKm: number;
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  todayHours: string | null;
  weekHours: string[];
  phone: string | null;
  mapsUrl: string;
  category: string;
  acceptedInsurance: string[] | null; // verified list, null = we have no verified data
  website: string | null;
  websiteScan: WebsiteScan | null; // null = not checked yet
  insuranceStatus: InsuranceStatus;
};

export type PlacesResponse = {
  places: Place[];
  source: "google" | "sample";
};
