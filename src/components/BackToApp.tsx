"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { LogoMark } from "./Logo";
import { useApp } from "@/context/AppContext";

// On iPhone, the home-screen app opens Google sign-in in a browser sheet (✕ + web address on top),
// and iOS keeps showing that sheet even after it comes back to Health Here. Apple doesn't let a page
// close it, so we cover the page and tell people to tap ✕ — the app behind it is already signed in.
const FLAG = "hh-oauth-from-app";
const FRESH_MS = 15 * 60_000;

const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function BackToApp() {
  const { t } = useApp();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let at = 0;
    try {
      at = Number(localStorage.getItem(FLAG) ?? 0);
    } catch {}
    if (!at) return;
    if (standalone()) {
      // Back in the real app — sign-in is done (or was cancelled).
      try {
        localStorage.removeItem(FLAG);
      } catch {}
      return;
    }
    if (Date.now() - at < FRESH_MS && !location.pathname.startsWith("/auth/callback")) setShow(true);
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center gap-5 bg-brand px-8 text-center text-forest" role="dialog" aria-modal="true">
      <LogoMark className="h-20 w-20" />
      <p className="text-2xl font-bold">{t("backToAppTitle")}</p>
      <p className="flex max-w-xs items-center gap-2 text-lg">{t("backToAppBody")}</p>
      <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-forest/40" aria-hidden>
        <X className="h-6 w-6" />
      </span>
      <button
        type="button"
        className="mt-4 text-sm font-medium underline underline-offset-4"
        onClick={() => {
          try {
            localStorage.removeItem(FLAG);
          } catch {}
          setShow(false);
        }}
      >
        {t("signedInContinueHere")}
      </button>
    </div>
  );
}
