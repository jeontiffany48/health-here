"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { insuranceStatusFor } from "./insuranceMatch";
import { distanceKm } from "./geo";
import type { LatLng, Place, PlaceKind, PlacesResponse, WebsiteScan } from "./types";

const SCAN_CONCURRENCY = 3;

// ---- Cost savers ----
// 1) Search from a point rounded to ~100 m, so small GPS jitter doesn't count as a "new" search.
// 2) Reuse the same search on this device for 1 hour instead of asking Google again.
const CACHE_PREFIX = "hh-places:";
const CACHE_MS = 60 * 60 * 1000;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function readCache(key: string): PlacesResponse | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: PlacesResponse };
    if (Date.now() - at > CACHE_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
function writeCache(key: string, data: PlacesResponse) {
  try {
    // keep the cache small: drop expired entries first
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) {
        try {
          if (Date.now() - JSON.parse(localStorage.getItem(k) || "{}").at > CACHE_MS) localStorage.removeItem(k);
        } catch {
          localStorage.removeItem(k);
        }
      }
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or blocked — just skip caching */
  }
}

/**
 * Loads places near a location. Then, for places with a website but no insurance data yet,
 * asks the server to read their website (a few at a time) and updates each card as results arrive.
 */
export function usePlaces(kind: PlaceKind, query: string, location: LatLng | null, insurance: string) {
  const [data, setData] = useState<PlacesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [scanning, setScanning] = useState<Set<string>>(new Set());
  const insuranceRef = useRef(insurance);
  insuranceRef.current = insurance;

  const lat = location?.lat;
  const lng = location?.lng;

  useEffect(() => {
    if (lat == null || lng == null) return;
    const ctrl = new AbortController();
    const qLat = round3(lat);
    const qLng = round3(lng);
    const key = `${kind}|${query}|${qLat}|${qLng}`;
    // Distances from the exact spot (the search itself used the rounded one); statuses for the current plan.
    const finish = (d: PlacesResponse) => ({
      ...d,
      places: d.places.map((p) => ({ ...p, distanceKm: distanceKm({ lat, lng }, p.location), insuranceStatus: insuranceStatusFor(p, insuranceRef.current) })),
    });

    const cached = readCache(key);
    if (cached) {
      setError(false);
      setLoading(false);
      const d = finish(cached);
      setData(d);
      startScans(d.places, ctrl.signal);
      return () => ctrl.abort();
    }

    const now = new Date();
    const params = new URLSearchParams({
      kind,
      q: query,
      lat: String(qLat),
      lng: String(qLng),
      insurance,
      dow: String(now.getDay()),
      mins: String(now.getHours() * 60 + now.getMinutes()),
    });
    setLoading(true);
    setError(false);
    fetch(`/api/places?${params}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: PlacesResponse) => {
        if (d.source === "google") writeCache(key, d);
        const f = finish(d);
        setData(f);
        startScans(f.places, ctrl.signal);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, query, lat, lng, nonce]);

  // Re-label cards when the user changes their plan (no refetch needed).
  useEffect(() => {
    setData((d) => (d ? { ...d, places: d.places.map((p) => ({ ...p, insuranceStatus: insuranceStatusFor(p, insurance) })) } : d));
  }, [insurance]);

  function startScans(places: Place[], signal: AbortSignal) {
    const queue = places.filter((p) => p.website && !p.websiteScan && !p.acceptedInsurance);
    if (!queue.length) return;
    setScanning(new Set(queue.map((p) => p.id)));
    const worker = async () => {
      while (queue.length && !signal.aborted) {
        const p = queue.shift()!;
        let scan: WebsiteScan | null = null;
        try {
          const r = await fetch(`/api/insurance-scan?${new URLSearchParams({ placeId: p.id, website: p.website! })}`, { signal });
          if (r.ok) scan = await r.json();
        } catch {
          /* aborted or failed: leave as unknown */
        }
        if (signal.aborted) return;
        setScanning((s) => {
          const n = new Set(s);
          n.delete(p.id);
          return n;
        });
        if (scan) {
          setData((d) =>
            d
              ? {
                  ...d,
                  places: d.places.map((x) => (x.id === p.id ? { ...x, websiteScan: scan, insuranceStatus: insuranceStatusFor({ ...x, websiteScan: scan }, insuranceRef.current) } : x)),
                }
              : d,
          );
        }
      }
    };
    for (let i = 0; i < SCAN_CONCURRENCY; i++) worker();
  }

  const retry = useCallback(() => setNonce((n) => n + 1), []); // errors are never cached, so retry always asks again
  return { data, loading, error, retry, scanning };
}
