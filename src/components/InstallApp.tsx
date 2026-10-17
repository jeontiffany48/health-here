"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, MoreVertical, Share, SquarePlus, X } from "lucide-react";
import { useApp } from "@/context/AppContext";

// "Download the app" — installs Health Here to the home screen (it's a web app, so no app store).
// Android / Chrome / Edge: shows the browser's own install prompt.
// iPhone / iPad: Apple doesn't allow a prompt, so we show the 2-step Share → Add to Home Screen.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// The browser fires this once, often before the button is on screen — catch it early.
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const isIOS = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function InstallApp({ className = "" }: { className?: string }) {
  const { t } = useApp();
  const [, rerender] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState<"ios" | "other" | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setInstalled(isStandalone());
    const l = () => {
      rerender((n) => n + 1);
      if (!deferred && isStandalone()) setInstalled(true);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  if (!mounted) return null;
  if (installed)
    return (
      <p className={`flex items-center justify-center gap-2 text-sm text-ok ${className}`}>
        <CheckCircle2 className="h-4 w-4" aria-hidden /> {t("appInstalled")}
      </p>
    );

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      deferred = null;
      rerender((n) => n + 1);
      return;
    }
    setHelp(isIOS() ? "ios" : "other");
  }

  return (
    <div className={className}>
      <button type="button" onClick={install} className="btn-ghost w-full">
        <Download className="h-5 w-5" aria-hidden /> {t("downloadApp")}
      </button>
      {help && (
        <div className="relative mt-2 rounded-xl border border-line bg-surface p-4 text-sm" role="dialog" aria-label={t("downloadApp")}>
          <button type="button" onClick={() => setHelp(null)} className="absolute right-2 top-2 p-1 text-muted" aria-label={t("close")}>
            <X className="h-4 w-4" />
          </button>
          <p className="pr-6 font-semibold">{t("installHowTitle")}</p>
          {help === "ios" ? (
            <ol className="mt-2 space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-semibold">1.</span>
                <span>
                  {t("installIos1")} <Share className="inline h-4 w-4 align-[-2px]" aria-label="Share" />
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold">2.</span>
                <span>
                  {t("installIos2")} <SquarePlus className="inline h-4 w-4 align-[-2px]" aria-hidden />
                </span>
              </li>
            </ol>
          ) : (
            <p className="mt-2">
              {t("installOther")} <MoreVertical className="inline h-4 w-4 align-[-2px]" aria-hidden />
            </p>
          )}
          <p className="mt-2 text-xs text-muted">{t("installNote")}</p>
        </div>
      )}
    </div>
  );
}
