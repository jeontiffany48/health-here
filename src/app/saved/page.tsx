"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PlaceCard } from "@/components/PlaceCard";
import { useApp } from "@/context/AppContext";
import { useFavorites, type Favorite } from "@/context/FavoritesContext";
import { distanceKm } from "@/lib/geo";
import { withLiveHours, useNow } from "@/lib/hours";
import type { Place } from "@/lib/types";

export default function SavedPage() {
  return (
    <AppShell locationGate={false}>
      <Saved />
    </AppShell>
  );
}

// Details are looked up fresh (we only keep place IDs); reuse them for an hour on this device.
const CACHE_KEY = "hh-saved-details";
const CACHE_MS = 60 * 60 * 1000;
type Cache = { at: number; places: Record<string, Place> };
const readCache = (): Cache => {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as Cache | null;
    if (c && Date.now() - c.at < CACHE_MS) return c;
  } catch {}
  return { at: Date.now(), places: {} };
};

function Saved() {
  const { t, mode, profile, location } = useApp();
  const { favorites, sampleSnapshots } = useFavorites();
  const now = useNow();
  const [details, setDetails] = useState<Record<string, Place>>({});
  const [loading, setLoading] = useState(false);

  // Look up the saved places we don't have details for yet
  useEffect(() => {
    const cache = readCache();
    const known = { ...cache.places, ...sampleSnapshots };
    const missing = favorites.filter((f) => !known[f.id]);
    setDetails(known);
    if (missing.length === 0) return;
    setLoading(true);
    const params = new URLSearchParams({
      ids: missing.map((f) => `${f.kind}:${f.id}`).join(","),
      insurance: profile.insurance,
      dow: String(new Date().getDay()),
    });
    fetch(`/api/place-details?${params}`)
      .then((r) => (r.ok ? r.json() : { places: [] }))
      .then((d: { places: Place[] }) => {
        const next = { ...cache.places };
        for (const p of d.places) next[p.id] = p;
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: cache.at, places: next }));
        } catch {}
        setDetails({ ...next, ...sampleSnapshots });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites.map((f) => f.id).join(","), profile.insurance]);

  const groups = useMemo(() => {
    const withDist = (f: Favorite) => {
      const p = details[f.id];
      if (!p) return null;
      return { ...p, distanceKm: location ? distanceKm(location, p.location) : NaN };
    };
    const pick = (kinds: Favorite["kind"][]) =>
      withLiveHours(
        favorites
          .filter((f) => kinds.includes(f.kind))
          .map(withDist)
          .filter((p): p is Place => Boolean(p)),
        now,
      );
    return [
      { key: "facility" as const, title: t("facilities"), places: pick(["facility", "er"]) },
      { key: "doctor" as const, title: t("doctors"), places: pick(["doctor"]) },
    ];
  }, [favorites, details, location, now, t]);

  const missingCount = favorites.filter((f) => !details[f.id]).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 lg:px-8 lg:py-8">
      <div className="flex items-center gap-3">
        <Link href="/home" className="btn-ghost !min-h-12 !px-3" aria-label={t("backHome")}>
          <ArrowLeft className="h-5 w-5" aria-hidden />
          <span className="hidden sm:inline">{t("backHome")}</span>
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold lg:text-3xl">
          <Star className="h-7 w-7 fill-[#f5b301] text-[#f5b301]" aria-hidden /> {t("savedPlaces")}
        </h1>
      </div>

      {favorites.length === 0 ? (
        <div className="card mt-6 p-6 text-center">
          <Star className="mx-auto h-10 w-10 text-muted" aria-hidden />
          <p className="mt-3 font-semibold">{t("savedEmpty")}</p>
          <p className="mt-1 text-sm text-muted">{t("savedEmptyHint")}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link href="/find/facilities" className="btn-primary">
              {t("facilities")}
            </Link>
            <Link href="/find/doctors" className="btn-ghost">
              {t("doctors")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {groups.map(
            (g) =>
              g.places.length > 0 && (
                <section key={g.key}>
                  <h2 className="mb-3 text-lg font-semibold">
                    {g.title} <span className="text-muted">({g.places.length})</span>
                  </h2>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {g.places.map((p, i) => (
                      <PlaceCard key={p.id} place={p} index={i} kind={g.key} sample={Boolean(sampleSnapshots[p.id])} />
                    ))}
                  </div>
                </section>
              ),
          )}
          {loading && missingCount > 0 && <div className="card h-32 animate-pulse bg-surface" aria-label={t("locating")} />}
          {!loading && missingCount > 0 && <p className="text-sm text-muted">{t("savedSomeMissing", { n: missingCount })}</p>}
        </div>
      )}
      {favorites.length > 0 && <p className="mt-6 text-xs text-muted">{mode === "user" ? t("savedNoteAccount") : t("savedNoteDevice")}</p>}
    </div>
  );
}
