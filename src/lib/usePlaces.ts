"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { insuranceStatusFor } from "./insuranceMatch";
import type { LatLng, Place, PlaceKind, PlacesResponse, WebsiteScan } from "./types";

const SCAN_CONCURRENCY = 3;

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
    const now = new Date();
    const params = new URLSearchParams({
      kind,
      q: query,
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
      insurance,
      dow: String(now.getDay()),
      mins: String(now.getHours() * 60 + now.getMinutes()),
    });
    setLoading(true);
    setError(false);
    fetch(`/api/places?${params}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: PlacesResponse) => {
        setData(d);
        startScans(d.places, ctrl.signal);
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

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, retry, scanning };
}
