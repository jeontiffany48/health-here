// Finds insurance plan names in text from a hospital/clinic website.
// Shared by the server scanner and the UI status logic. No network code here.
import type { InsuranceStatus, Place } from "./types";

/**
 * Regexes per plan id (case-insensitive). Sub-plans (e.g. Aetna Medicare) only match their
 * specific name — a site listing plain "Aetna" does NOT imply it takes Aetna's Medicare plans.
 */
const PATTERNS: Record<string, RegExp[]> = {
  aetna: [/\baetna\b(?!\s*(medicare|better health))/],
  cigna: [/\bcigna\b/],
  humana: [/\bhumana\b(?!\s*(medicare|gold))/],
  kaiser: [/\bkaiser\b/],
  unitedhealthcare: [/\bunited\s*health\s*care\b(?!\s*community)/, /\buhc\b/],
  anthem: [/\banthem\b/, /\belevance\b/],
  oscar: [/\boscar\b(\s*health)?/],
  ambetter: [/\bambetter\b/],
  molina: [/\bmolina\b/],
  multiplan: [/\bmulti\s?plan\b/, /\bphcs\b/],
  "first-health": [/\bfirst health\b/],
  meritain: [/\bmeritain\b/],
  umr: [/\bumr\b/],
  bcbs: [/\bblue\s*cross\b/, /\bblue\s*shield\b/, /\bbcbs\w*\b/],
  "bcbs-fep": [/federal employee program/, /\bfep\b/],
  "bcbs-il-tx": [/blue cross (and|&) blue shield of (illinois|texas)/, /\bbcbs(il|tx)\b/, /\bhcsc\b/],
  "bcbs-ma": [/blue cross (and|&) blue shield of massachusetts/, /\bbcbsma\b/],
  "bcbs-mi": [/blue cross (and|&) blue shield of michigan/, /\bbcbsm\b/, /blue care network/],
  "blue-shield-ca": [/blue shield of california/],
  carefirst: [/\bcarefirst\b/],
  "florida-blue": [/\bflorida blue\b/],
  highmark: [/\bhighmark\b/],
  horizon: [/\bhorizon\b.{0,20}\b(bcbs|blue)/, /\bhorizon nj health\b/],
  independence: [/\bindependence blue cross\b/, /\bibx\b/],
  premera: [/\bpremera\b/],
  regence: [/\bregence\b/],
  wellmark: [/\bwellmark\b/],
  caresource: [/\bcaresource\b/],
  emblemhealth: [/\bemblem\s*health\b/, /\bghi\b/, /\bhip\b(?= )/],
  fidelis: [/\bfidelis\b/],
  geisinger: [/\bgeisinger health plan\b/],
  "harvard-pilgrim": [/\bharvard pilgrim\b/],
  "health-net": [/\bhealth\s*net\b/],
  healthfirst: [/\bhealthfirst\b/],
  "medical-mutual": [/\bmedical mutual\b/],
  "priority-health": [/\bpriority health\b/],
  selecthealth: [/\bselect\s*health\b/],
  tufts: [/\btufts health\b/],
  upmc: [/\bupmc health plan\b/],
  medicare: [/\bmedicare\b(?!\s*advantage)/],
  "aarp-uhc": [/\baarp\b/],
  "humana-medicare": [/\bhumana\b.{0,25}\bmedicare\b/, /\bhumana gold\b/],
  "aetna-medicare": [/\baetna\b.{0,25}\bmedicare\b/],
  wellcare: [/\bwell\s*care\b/],
  devoted: [/\bdevoted health\b/],
  scan: [/\bscan health\b/],
  alignment: [/\balignment health\b/],
  clover: [/\bclover health\b/],
  medicaid: [/\bmedicaid\b/, /\bmedi-cal\b/, /\bmasshealth\b/, /\btenncare\b/, /\bsoonercare\b/, /\bbadgercare\b/, /\bnj familycare\b/, /\bhusky health\b/, /\bapple health\b/],
  chip: [/\bchip\b/, /children'?s health insurance program/],
  "uhc-community": [/united\s*health\s*care community/],
  "aetna-better-health": [/\baetna better health\b/],
  tricare: [/\btricare\b/],
  va: [/\bva community care\b/, /\bveterans affairs\b/, /\bvaccn\b/],
};

const NEGATIVE = /\b(not|no longer|don'?t|do not|does not|doesn'?t|cannot|can'?t|out[- ]of[- ]network|non[- ]participating|terminated|ended|except)\b/;

/** Plan ids mentioned positively in the text. Sentences with "not accepted", "out-of-network" etc. are ignored. */
export function findPlans(text: string): string[] {
  const sentences = text.toLowerCase().replace(/\s+/g, " ").split(/(?<=[.!?;•|])\s+|\n/);
  const found = new Set<string>();
  for (const s of sentences) {
    if (s.length > 4000) continue;
    const negative = NEGATIVE.test(s);
    for (const [id, regs] of Object.entries(PATTERNS)) {
      if (!found.has(id) && regs.some((r) => r.test(s)) && !negative) found.add(id);
    }
  }
  return [...found];
}

/** Words that suggest a page is about insurance — used to pick which links to follow. */
export const INSURANCE_LINK_HINT = /insurance|insurances|accepted plans|health plans|plans we accept|payer|billing|financial|payment|coverage/i;

/** Final status for one place and the user's plan. */
export function insuranceStatusFor(p: Pick<Place, "acceptedInsurance" | "websiteScan">, plan: string): InsuranceStatus {
  if (!plan) return "unknown";
  if (p.acceptedInsurance) return p.acceptedInsurance.includes(plan) ? "accepted" : "not_accepted";
  if (p.websiteScan && p.websiteScan.foundInsurancePage) {
    if (p.websiteScan.plans.includes(plan)) return "website_listed";
    // Only say "not listed" when the page clearly shows a real list (2+ other plans).
    if (p.websiteScan.plans.length >= 2) return "website_not_listed";
  }
  return "unknown";
}
