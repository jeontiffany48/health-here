// U.S. insurance plans. Ids are stable keys stored in the database (profiles.insurance,
// provider_insurance.insurance_id) — don't rename an id once people have saved it; add new ones instead.
export type PlanGroup = "national" | "bcbs" | "regional" | "medicare" | "medicaid" | "other";

export const PLAN_GROUPS: { id: PlanGroup; label: string }[] = [
  { id: "national", label: "Major national plans" },
  { id: "bcbs", label: "Blue Cross Blue Shield plans" },
  { id: "regional", label: "Regional plans" },
  { id: "medicare", label: "Medicare & Medicare Advantage" },
  { id: "medicaid", label: "Medicaid, CHIP & government" },
  { id: "other", label: "Other" },
];

export const INSURANCE_PLANS: { id: string; label: string; group: PlanGroup }[] = [
  // Major national
  { id: "aetna", label: "Aetna", group: "national" },
  { id: "cigna", label: "Cigna", group: "national" },
  { id: "humana", label: "Humana", group: "national" },
  { id: "kaiser", label: "Kaiser Permanente", group: "national" },
  { id: "unitedhealthcare", label: "UnitedHealthcare", group: "national" },
  { id: "anthem", label: "Anthem (Elevance Health)", group: "national" },
  { id: "oscar", label: "Oscar Health", group: "national" },
  { id: "ambetter", label: "Ambetter (Marketplace)", group: "national" },
  { id: "molina", label: "Molina Healthcare", group: "national" },
  { id: "multiplan", label: "MultiPlan / PHCS network", group: "national" },
  { id: "first-health", label: "First Health network", group: "national" },
  { id: "meritain", label: "Meritain Health", group: "national" },
  { id: "umr", label: "UMR", group: "national" },

  // Blue Cross Blue Shield
  { id: "bcbs", label: "Blue Cross Blue Shield (other state)", group: "bcbs" },
  { id: "bcbs-fep", label: "BCBS Federal Employee Program", group: "bcbs" },
  { id: "bcbs-il-tx", label: "BCBS of Illinois / Texas (HCSC)", group: "bcbs" },
  { id: "bcbs-ma", label: "Blue Cross Blue Shield of Massachusetts", group: "bcbs" },
  { id: "bcbs-mi", label: "Blue Cross Blue Shield of Michigan", group: "bcbs" },
  { id: "blue-shield-ca", label: "Blue Shield of California", group: "bcbs" },
  { id: "carefirst", label: "CareFirst BCBS", group: "bcbs" },
  { id: "florida-blue", label: "Florida Blue", group: "bcbs" },
  { id: "highmark", label: "Highmark", group: "bcbs" },
  { id: "horizon", label: "Horizon BCBS of New Jersey", group: "bcbs" },
  { id: "independence", label: "Independence Blue Cross", group: "bcbs" },
  { id: "premera", label: "Premera Blue Cross", group: "bcbs" },
  { id: "regence", label: "Regence", group: "bcbs" },
  { id: "wellmark", label: "Wellmark BCBS", group: "bcbs" },

  // Regional
  { id: "caresource", label: "CareSource", group: "regional" },
  { id: "emblemhealth", label: "EmblemHealth", group: "regional" },
  { id: "fidelis", label: "Fidelis Care", group: "regional" },
  { id: "geisinger", label: "Geisinger Health Plan", group: "regional" },
  { id: "harvard-pilgrim", label: "Harvard Pilgrim", group: "regional" },
  { id: "health-net", label: "Health Net", group: "regional" },
  { id: "healthfirst", label: "Healthfirst", group: "regional" },
  { id: "medical-mutual", label: "Medical Mutual", group: "regional" },
  { id: "priority-health", label: "Priority Health", group: "regional" },
  { id: "selecthealth", label: "SelectHealth", group: "regional" },
  { id: "tufts", label: "Tufts Health Plan", group: "regional" },
  { id: "upmc", label: "UPMC Health Plan", group: "regional" },

  // Medicare
  { id: "medicare", label: "Original Medicare (Parts A & B)", group: "medicare" },
  { id: "aarp-uhc", label: "AARP Medicare Advantage (UnitedHealthcare)", group: "medicare" },
  { id: "humana-medicare", label: "Humana Medicare Advantage", group: "medicare" },
  { id: "aetna-medicare", label: "Aetna Medicare Advantage", group: "medicare" },
  { id: "wellcare", label: "Wellcare", group: "medicare" },
  { id: "devoted", label: "Devoted Health", group: "medicare" },
  { id: "scan", label: "SCAN Health Plan", group: "medicare" },
  { id: "alignment", label: "Alignment Health", group: "medicare" },
  { id: "clover", label: "Clover Health", group: "medicare" },

  // Medicaid / government
  { id: "medicaid", label: "Medicaid (state plan)", group: "medicaid" },
  { id: "chip", label: "CHIP (children's coverage)", group: "medicaid" },
  { id: "uhc-community", label: "UnitedHealthcare Community Plan", group: "medicaid" },
  { id: "aetna-better-health", label: "Aetna Better Health", group: "medicaid" },
  { id: "tricare", label: "TRICARE (military)", group: "medicaid" },
  { id: "va", label: "VA Community Care (veterans)", group: "medicaid" },

  // Other
  { id: "other", label: "Other / not listed", group: "other" },
  { id: "none", label: "No insurance / self-pay", group: "other" },
];

export function insuranceLabel(id: string) {
  return INSURANCE_PLANS.find((p) => p.id === id)?.label ?? "Not set";
}

/** Plans grouped for pickers, optionally filtered by a search string. */
export function groupedPlans(query = "") {
  const q = query.trim().toLowerCase();
  return PLAN_GROUPS.map((g) => ({
    ...g,
    plans: INSURANCE_PLANS.filter((p) => p.group === g.id && (!q || p.label.toLowerCase().includes(q) || p.id.includes(q))),
  })).filter((g) => g.plans.length > 0);
}

export const SPECIALTIES = [
  { id: "primary care doctor", key: "sp_primary" },
  { id: "pediatrician", key: "sp_pediatrics" },
  { id: "cardiologist", key: "sp_cardiology" },
  { id: "dermatologist", key: "sp_dermatology" },
  { id: "orthopedic doctor", key: "sp_orthopedics" },
  { id: "obstetrician gynecologist", key: "sp_obgyn" },
  { id: "neurologist", key: "sp_neurology" },
  { id: "psychiatrist", key: "sp_psychiatry" },
  { id: "ophthalmologist", key: "sp_ophthalmology" },
  { id: "dentist", key: "sp_dentist" },
  { id: "ear nose throat doctor", key: "sp_ent" },
  { id: "endocrinologist", key: "sp_endocrinology" },
] as const;
