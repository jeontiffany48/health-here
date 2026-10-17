"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatAccuracy } from "@/lib/geo";
import { LocationPicker } from "./LocationPicker";

const addressCache = new Map<string, string>();

/** "Searching near: 12 Oak St · accurate to ~30 ft  [Change]" — makes the search center obvious and easy to fix. */
export function LocationBar({ className = "" }: { className?: string }) {
  const { t, profile, location, locationLabel, locationAccuracy, locStatus, locationSavedAt } = useApp();
  const daysLeft = locationSavedAt ? Math.max(0, 7 - Math.floor((Date.now() - locationSavedAt) / 86400_000)) : null;
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  // Device location → readable street address
  useEffect(() => {
    if (!location || locationLabel) return;
    const key = `${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;
    if (addressCache.has(key)) return setAddress(addressCache.get(key)!);
    setAddress(null);
    const ctrl = new AbortController();
    fetch(`/api/geocode?lat=${location.lat}&lng=${location.lng}&lang=${profile.language}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const label = d?.label ?? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
        addressCache.set(key, label);
        setAddress(label);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [location, locationLabel, profile.language]);

  const approximate = locationAccuracy != null && locationAccuracy > 500;
  const label = locationLabel ?? address ?? (locStatus === "locating" ? t("locating") : t("findingAddress"));

  return (
    <div className={className}>
      <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${approximate ? "border-warn/40 bg-[#fff4e0]" : "border-line bg-surface"}`}>
        {approximate ? <AlertTriangle className="h-5 w-5 shrink-0 text-warn" aria-hidden /> : <MapPin className="h-5 w-5 shrink-0 text-forest" aria-hidden />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="line-clamp-2">
            <span className="text-muted">{t("searchingNear")}: </span>
            <span className="font-semibold">{location ? label : t("notSet")}</span>
          </p>
          {location && (
            <p className={`text-xs ${approximate ? "font-medium text-warn" : "text-muted"}`}>
              {locationAccuracy == null
                ? t("exactAddress")
                : approximate
                  ? t("approxWarn", { d: formatAccuracy(locationAccuracy, profile.language) })
                  : t("accurateTo", { d: formatAccuracy(locationAccuracy, profile.language) })}
              {daysLeft != null && <> · {daysLeft <= 1 ? t("savedLocationToday") : t("savedLocation", { d: daysLeft })}</>}
            </p>
          )}
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="btn-ghost !min-h-10 shrink-0 !px-3 text-sm" aria-expanded={open}>
          {open ? t("done") : t("change")}
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-card p-3">
          <LocationPicker onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
