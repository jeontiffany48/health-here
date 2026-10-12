"use client";

import { useState } from "react";
import { Check, Search, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { groupedPlans } from "@/lib/insurance";

/** Searchable, grouped insurance list. Used in onboarding and Settings. */
export function InsurancePicker({ value, onChange, maxHeight = "24rem" }: { value: string; onChange: (id: string) => void; maxHeight?: string }) {
  const { t } = useApp();
  const [q, setQ] = useState("");
  const groups = groupedPlans(q);

  return (
    <div>
      <label className="field">
        <Search className="h-5 w-5 text-muted" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlans")} aria-label={t("searchPlans")} />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="text-muted">
            <X className="h-5 w-5" />
          </button>
        )}
      </label>
      <div className="mt-3 overflow-y-auto rounded-xl border border-line" style={{ maxHeight }} role="radiogroup" aria-label={t("insurance")}>
        {groups.length === 0 && <p className="p-4 text-sm text-muted">{t("noPlanMatch")}</p>}
        {groups.map((g) => (
          <div key={g.id}>
            <p className="sticky top-0 z-10 border-b border-line bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</p>
            {g.plans.map((p) => {
              const selected = value === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(p.id)}
                  className={`flex min-h-12 w-full items-center justify-between border-b border-line px-4 text-left font-medium transition last:border-b-0 ${selected ? "bg-brand/40 text-forest" : "bg-card hover:bg-surface"}`}
                >
                  {p.label}
                  {selected && <Check className="h-5 w-5 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
