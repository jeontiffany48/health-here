"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useApp } from "./AppContext";
import type { Place, PlaceKind } from "@/lib/types";

// Starred places. Accounts save them in Supabase (follows you to any device);
// guests keep them on this device. Only Google's place ID is stored — the Saved list
// looks up fresh details when it's opened (Google's terms allow storing place IDs).

export type Favorite = { id: string; kind: PlaceKind; at: number };

type Ctx = {
  favorites: Favorite[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (place: Place, kind: PlaceKind, sample?: boolean) => void;
  /** Sample places (no Google key) can't be looked up again, so they're kept on this device. */
  sampleSnapshots: Record<string, Place>;
};

const LOCAL_KEY = "hh-favorites";
const SAMPLE_KEY = "hh-fav-samples";
const FavCtx = createContext<Ctx | null>(null);

const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const writeLocal = (key: string, v: unknown) => {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {}
};

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useApp();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [samples, setSamples] = useState<Record<string, Place>>({});
  // "account" = saved in Supabase; "device" = this browser only (guests, or if the table isn't set up yet)
  const store = useRef<"account" | "device">("device");
  const uid = useRef<string | null>(null);

  // Load whenever who's using the app changes
  useEffect(() => {
    if (mode === "loading") return;
    setSamples(readLocal(SAMPLE_KEY, {}));
    let cancelled = false;
    (async () => {
      const local = readLocal<Favorite[]>(LOCAL_KEY, []);
      const sb = getSupabase();
      if (mode === "user" && sb) {
        const { data: u } = await sb.auth.getUser();
        uid.current = u.user?.id ?? null;
        const { data, error } = await sb.from("favorites").select("place_id, kind, created_at").order("created_at", { ascending: false });
        if (!error && uid.current) {
          store.current = "account";
          let list: Favorite[] = (data ?? []).map((r) => ({ id: r.place_id, kind: r.kind, at: Date.parse(r.created_at) }));
          // Stars added as a guest on this device move into the account.
          const extra = local.filter((f) => !list.some((x) => x.id === f.id));
          if (extra.length) {
            await sb.from("favorites").upsert(extra.map((f) => ({ user_id: uid.current, place_id: f.id, kind: f.kind })));
            list = [...extra, ...list];
          }
          writeLocal(LOCAL_KEY, null);
          if (!cancelled) setFavorites(list);
          return;
        }
        console.warn("favorites table not available — saving stars on this device", error?.message);
      }
      store.current = "device";
      if (!cancelled) setFavorites(local);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const isFavorite = useCallback((id: string) => favorites.some((f) => f.id === id), [favorites]);

  const toggleFavorite = useCallback(
    (place: Place, kind: PlaceKind, sample = false) => {
      const on = !favorites.some((f) => f.id === place.id);
      const next = on ? [{ id: place.id, kind, at: Date.now() }, ...favorites] : favorites.filter((f) => f.id !== place.id);
      setFavorites(next);

      if (sample) {
        const s = { ...readLocal<Record<string, Place>>(SAMPLE_KEY, {}) };
        if (on) s[place.id] = place;
        else delete s[place.id];
        writeLocal(SAMPLE_KEY, s);
        setSamples(s);
      }

      const sb = getSupabase();
      if (store.current === "account" && sb && uid.current) {
        const q = on
          ? sb.from("favorites").upsert({ user_id: uid.current, place_id: place.id, kind })
          : sb.from("favorites").delete().eq("user_id", uid.current).eq("place_id", place.id);
        q.then(({ error }) => {
          if (error) {
            console.warn("couldn't save star", error.message);
            setFavorites(favorites); // undo
          }
        });
      } else writeLocal(LOCAL_KEY, next);
    },
    [favorites],
  );

  const value = useMemo(() => ({ favorites, isFavorite, toggleFavorite, sampleSnapshots: samples }), [favorites, isFavorite, toggleFavorite, samples]);
  return <FavCtx.Provider value={value}>{children}</FavCtx.Provider>;
}

export function useFavorites() {
  const c = useContext(FavCtx);
  if (!c) throw new Error("useFavorites must be inside FavoritesProvider");
  return c;
}
