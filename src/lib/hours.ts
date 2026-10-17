"use client";

import { useEffect, useState } from "react";
import type { Place, Period } from "./types";

// Live "Open / Closed" — worked out on the phone from the place's weekly schedule, so it stays
// right as the clock moves (no extra API calls). Uses the place's own time zone when Google gives it.

const WEEK = 7 * 24 * 60;
const toMin = (p: { day: number; hour: number; minute: number }) => p.day * 1440 + p.hour * 60 + p.minute;

/** Minutes since Sunday 00:00 in the place's local time (falls back to the phone's time zone). */
function placeWeekMinute(now: Date, utcOffsetMinutes: number | null) {
  if (utcOffsetMinutes == null) return now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
  const local = new Date(now.getTime() + utcOffsetMinutes * 60_000);
  return local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes();
}

const locale = (lang: string) => (lang === "ko" ? "ko-KR" : lang === "es" ? "es-US" : "en-US");
function fmtTime(h: number, m: number, lang: string) {
  const d = new Date(Date.UTC(2000, 0, 2, h, m));
  return d.toLocaleTimeString(locale(lang), { hour: "numeric", minute: m ? "2-digit" : undefined, timeZone: "UTC" });
}
/** Short weekday name for Google's day number (0 = Sunday). 2000-01-02 was a Sunday. */
const fmtDay = (day: number, lang: string) => new Date(Date.UTC(2000, 0, 2 + day)).toLocaleDateString(locale(lang), { weekday: "short", timeZone: "UTC" });

export type LiveHours = {
  openNow: boolean | null;
  /** Index into weekHours (Monday = 0) for "today" at the place. */
  todayIndex: number;
  /** Next opening/closing, e.g. { kind: "closes", time: "5 PM", soon: true }. */
  next: { kind: "opens" | "closes"; time: string; soon: boolean; otherDay: boolean } | null;
  always: boolean;
};

export function liveHours(place: Pick<Place, "periods" | "utcOffsetMinutes" | "openNow">, now: Date, lang = "en"): LiveHours {
  const t = placeWeekMinute(now, place.utcOffsetMinutes);
  const todayIndex = (Math.floor(t / 1440) + 6) % 7;
  const periods = place.periods;
  if (!periods || periods.length === 0) return { openNow: place.openNow, todayIndex, next: null, always: false };

  // Open 24/7: a single period with no close.
  if (periods.length === 1 && !periods[0].close) return { openNow: true, todayIndex, next: null, always: true };

  let openNow = false;
  let best: { kind: "opens" | "closes"; at: number; p: Period["open"] } | null = null;
  for (const p of periods) {
    if (!p.close) continue;
    const o = toMin(p.open);
    let c = toMin(p.close);
    if (c <= o) c += WEEK; // runs past Saturday night into Sunday
    // Check this week and the wrap-around copy
    for (const shift of [0, -WEEK]) {
      if (t >= o + shift && t < c + shift) {
        openNow = true;
        const until = c + shift - t;
        if (!best || best.kind !== "closes" || until < best.at) best = { kind: "closes", at: until, p: p.close };
      }
    }
  }
  if (!openNow) {
    best = null;
    for (const p of periods) {
      let until = toMin(p.open) - t;
      if (until <= 0) until += WEEK;
      if (!best || until < best.at) best = { kind: "opens", at: until, p: p.open };
    }
  }
  let next: LiveHours["next"] = null;
  if (best) {
    const otherDay = Math.floor((t + best.at) / 1440) % 7 !== Math.floor(t / 1440);
    const time = fmtTime(best.p.hour, best.p.minute, lang);
    next = { kind: best.kind, time: otherDay ? `${fmtDay(best.p.day, lang)} ${time}` : time, soon: best.at <= 60, otherDay };
  }
  return { openNow, todayIndex, next, always: false };
}

/** The current time, refreshed at the start of every minute (and when the tab comes back into view). */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    const onVisible = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}

/** Places with openNow / todayHours recomputed for this minute (used for filtering and ranking). */
export function withLiveHours<T extends Place>(places: T[], now: Date): T[] {
  return places.map((p) => {
    if (!p.periods) return p;
    const h = liveHours(p, now);
    const line = p.weekHours[h.todayIndex];
    return { ...p, openNow: h.openNow, todayHours: line ? line.replace(/^[^:]+:\s*/, "") : p.todayHours };
  });
}
