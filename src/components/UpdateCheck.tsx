"use client";

import { useEffect } from "react";

// Apps saved to the iPhone/Android home screen stay paused in memory and keep showing an old
// version after an update. When the app comes back into view, check whether a newer version
// is live and quietly reload — unless the person is in the middle of typing.
const MIN_GAP_MS = 60_000;

export function UpdateCheck() {
  useEffect(() => {
    let current: string | null = null;
    let last = 0;
    const get = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        return r.ok ? ((await r.json()) as { version: string }).version : null;
      } catch {
        return null;
      }
    };
    get().then((v) => (current = v));

    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      const v = await get();
      if (!v || !current || v === current || v === "dev") return;
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (!typing) window.location.reload();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    const id = setInterval(check, 30 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
      clearInterval(id);
    };
  }, []);
  return null;
}
