"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, LocateOff, MapPin, Search, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatAccuracy } from "@/lib/geo";

type Suggestion = { id: string; main: string; secondary: string; lat?: number; lng?: number };

const newSession = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));

/**
 * Location settings: "Use my current location" (precise GPS) or type an exact street address
 * with live suggestions (Google Places Autocomplete when the key is set). Saves to the profile.
 */
export function LocationPicker({ onDone }: { onDone?: () => void }) {
  const { t, profile, updateProfile, requestDeviceLocation, locStatus, location, locationAccuracy, confirmLocation, deviceLocationOn, turnOffDeviceLocation } = useApp();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const session = useRef(newSession());

  const deviceOn = profile.locationMode === "device" && locStatus === "ok";

  async function useDevice() {
    setErr(null);
    await updateProfile({ locationMode: "device" });
    const ok = await requestDeviceLocation();
    if (!ok) setErr(t("needLocation"));
    else {
      confirmLocation();
      onDone?.();
    }
  }

  // Live suggestions (debounced)
  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) {
      setSuggestions([]);
      setNoMatch(false);
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: text, session: session.current, lang: profile.language });
        if (location) {
          params.set("lat", location.lat.toFixed(4));
          params.set("lng", location.lng.toFixed(4));
        }
        const r = await fetch(`/api/address-search?${params}`, { signal: ctrl.signal });
        const d = await r.json();
        setSuggestions(d.suggestions ?? []);
        setNoMatch((d.suggestions ?? []).length === 0);
      } catch {
        /* typing again aborts the previous request */
      }
      setSearching(false);
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function pick(s: Suggestion) {
    setErr(null);
    setSearching(true);
    try {
      let lat = s.lat,
        lng = s.lng,
        label = [s.main, s.secondary].filter(Boolean).join(", ");
      if (lat == null || lng == null) {
        const r = await fetch(`/api/address-search?${new URLSearchParams({ placeId: s.id, session: session.current, lang: profile.language })}`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        lat = d.lat;
        lng = d.lng;
        label = d.label || label;
      }
      await updateProfile({ locationMode: "manual", manualLocation: { lat: lat!, lng: lng!, label } });
      confirmLocation();
      session.current = newSession();
      setQ("");
      setSuggestions([]);
      onDone?.();
    } catch {
      setErr("We couldn't look up that address. Please try again.");
    }
    setSearching(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={useDevice} className={deviceOn ? "btn-ghost !border-ok !text-ok" : "btn-primary"} aria-pressed={deviceOn}>
        {locStatus === "locating" && profile.locationMode === "device" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LocateFixed className="h-5 w-5" aria-hidden />}
        {locStatus === "locating" && profile.locationMode === "device" ? t("locating") : deviceOn ? t("locationAllowed") : t("useCurrentLocation")}
      </button>
      {deviceOn && locationAccuracy != null && (
        <p className={`-mt-1 text-center text-xs ${locationAccuracy > 500 ? "text-warn" : "text-muted"}`}>
          {locationAccuracy > 500 ? t("approxWarn", { d: formatAccuracy(locationAccuracy, profile.language) }) : t("accurateTo", { d: formatAccuracy(locationAccuracy, profile.language) })}
        </p>
      )}

      {deviceLocationOn ? (
        <button type="button" onClick={() => turnOffDeviceLocation()} className="-mt-1 inline-flex items-center justify-center gap-1.5 self-center text-sm font-medium text-muted underline underline-offset-4">
          <LocateOff className="h-4 w-4" aria-hidden /> {t("turnOffLocation")}
        </button>
      ) : (
        <p className="-mt-1 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <LocateOff className="h-4 w-4 shrink-0" aria-hidden /> {t("locationOffNote")}
        </p>
      )}

      <div className="relative">
        <label className="field">
          <Search className="h-5 w-5 text-muted" aria-hidden />
          <input
            placeholder={t("enterAddress")}
            aria-label={t("enterAddress")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="street-address"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="address-suggestions"
          />
          {searching ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden />
          ) : (
            q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear" className="text-muted">
                <X className="h-5 w-5" />
              </button>
            )
          )}
        </label>
        {suggestions.length > 0 && (
          <ul id="address-suggestions" role="listbox" className="absolute inset-x-0 top-full z-[1200] mt-1 overflow-hidden rounded-xl border border-line bg-card shadow-lg">
            {suggestions.map((s) => (
              <li key={s.id} role="option" aria-selected={false}>
                <button type="button" onClick={() => pick(s)} className="flex min-h-12 w-full items-start gap-3 border-b border-line px-4 py-2.5 text-left last:border-b-0 hover:bg-surface">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
                  <span>
                    <span className="block font-medium">{s.main}</span>
                    {s.secondary && <span className="block text-sm text-muted">{s.secondary}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {noMatch && !searching && <p className="text-sm text-muted">{t("noAddressMatch")}</p>}

      {profile.locationMode === "manual" && profile.manualLocation && (
        <p className="flex items-center gap-2 rounded-xl bg-brand/40 p-3 text-sm text-forest">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden /> {profile.manualLocation.label} · {t("exactAddress")}
        </p>
      )}
      {err && (
        <p role="alert" className="text-sm text-sos-dark">
          {err}
        </p>
      )}
    </div>
  );
}
