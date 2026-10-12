// Clearly-labelled SAMPLE places, generated around the user's location so the app
// is fully testable before a Google Places API key is added. Never shown as real.
import type { LatLng, PlaceKind } from "./types";
import { INSURANCE_PLANS } from "./insurance";

export type RawPlace = {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  rating: number | null;
  ratingCount: number | null;
  weekHours: [number, number][] | "24h" | null; // per weekday Mon..Sun, [openHour, closeHour], [0,0] = closed
  phone: string | null;
  category: string;
  acceptedInsurance: string[];
};

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const STREETS = ["Main St", "Oak Ave", "Maple Dr", "Park Blvd", "Cedar Ln", "Elm St", "Washington Ave", "Lake Rd", "Hillside Dr", "River Rd"];
const FACILITY_NAMES = ["Riverside Community Hospital", "Northgate Urgent Care", "St. Anne Medical Center", "Lakeview Family Clinic", "Westside Health Center", "CityCare Walk-in Clinic", "Memorial Regional Hospital", "Greenfield Medical Clinic", "Harbor Point Hospital", "Sunrise Community Clinic"];
const ER_NAMES = ["Memorial Regional Hospital — Emergency", "St. Anne Medical Center — ER", "Riverside Community Hospital — ER", "Harbor Point Hospital — Emergency Dept.", "University Medical Center — ER"];
const LAST_NAMES = ["Kim", "Patel", "Garcia", "Johnson", "Nguyen", "Lee", "Martinez", "Chen", "Williams", "Brown", "Park", "Rodriguez"];
const FIRST = ["Sarah", "David", "Maria", "James", "Grace", "Daniel", "Emily", "Michael", "Sofia", "Andrew", "Hannah", "Joseph"];

const SPECIALTY_TITLE: Record<string, string> = {
  "primary care doctor": "Family Medicine",
  pediatrician: "Pediatrics",
  cardiologist: "Cardiology",
  dermatologist: "Dermatology",
  "orthopedic doctor": "Orthopedics",
  "obstetrician gynecologist": "OB-GYN",
  neurologist: "Neurology",
  psychiatrist: "Psychiatry",
  ophthalmologist: "Ophthalmology",
  dentist: "Dentistry",
  "ear nose throat doctor": "ENT",
  endocrinologist: "Endocrinology",
};

export function samplePlaces(kind: PlaceKind, query: string, center: LatLng): RawPlace[] {
  const rand = rng(hash(`${kind}|${query}|${center.lat.toFixed(2)}|${center.lng.toFixed(2)}`));
  const plans = INSURANCE_PLANS.filter((p) => p.id !== "none").map((p) => p.id);
  const count = kind === "er" ? 5 : 10;
  const out: RawPlace[] = [];

  for (let i = 0; i < count; i++) {
    // spread within ~1–12 km
    const r = (0.01 + rand() * 0.1) * (kind === "er" ? 1.2 : 1);
    const a = rand() * Math.PI * 2;
    const location = { lat: center.lat + r * Math.cos(a), lng: center.lng + (r * Math.sin(a)) / Math.cos((center.lat * Math.PI) / 180) };

    let name: string;
    let category: string;
    if (kind === "er") {
      name = ER_NAMES[i % ER_NAMES.length];
      category = "Emergency room";
    } else if (kind === "facility") {
      name = FACILITY_NAMES[i % FACILITY_NAMES.length];
      category = /Hospital|Medical Center/.test(name) ? "Hospital" : "Clinic";
    } else {
      const title = SPECIALTY_TITLE[query] ?? "Family Medicine";
      name = `Dr. ${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]}${query === "dentist" ? ", DDS" : ", MD"}`;
      category = title;
    }

    const accepted = plans.filter(() => rand() < 0.45);
    if (rand() < 0.3) accepted.push("medicare");
    if (category === "Clinic" || kind === "er") accepted.push("none"); // self-pay accepted

    let weekHours: RawPlace["weekHours"];
    if (kind === "er" || category === "Hospital") weekHours = "24h";
    else {
      const open = 7 + Math.floor(rand() * 3);
      const close = 16 + Math.floor(rand() * 5);
      const satOpen = rand() < 0.5;
      weekHours = [0, 1, 2, 3, 4].map(() => [open, close] as [number, number]);
      weekHours.push(satOpen ? [9, 13] : [0, 0], [0, 0]);
    }

    out.push({
      id: `sample-${kind}-${i}-${hash(name + i)}`,
      name,
      address: `${100 + Math.floor(rand() * 9800)} ${STREETS[Math.floor(rand() * STREETS.length)]}`,
      location,
      rating: rand() < 0.1 ? null : Math.round((3.2 + rand() * 1.8) * 10) / 10,
      ratingCount: Math.floor(8 + rand() * 900),
      weekHours,
      phone: `(555) ${String(100 + Math.floor(rand() * 899))}-${String(1000 + Math.floor(rand() * 8999))}`,
      category,
      acceptedInsurance: [...new Set(accepted)],
    });
  }
  return out;
}
