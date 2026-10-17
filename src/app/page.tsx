"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { LogoMark } from "@/components/Logo";

// How long the green "Health Here" screen stays up before the welcome / onboarding screens.
const SPLASH_MS = 1600;

// Splash: green logo screen, then routes people to the right place once we know who they are.
// Signed-in people heading to their dashboard aren't kept waiting.
export default function Splash() {
  const { mode, profile } = useApp();
  const router = useRouter();
  const shownAt = useRef(Date.now());

  useEffect(() => {
    // Email links that fell back to the bare site address still carry their token — send them on.
    const { search, hash } = window.location;
    if (/[?&]token_hash=/.test(search) || /access_token=|error=/.test(hash)) return window.location.replace(`/auth/confirm${search}${hash}`);
    if (/[?&]code=/.test(search)) return router.replace(`/auth/callback${search}`);
    if (mode === "loading") return;
    const dest = mode === "none" ? "/welcome" : profile.onboarded ? "/home" : "/onboarding";
    const wait = dest === "/home" ? 0 : Math.max(0, SPLASH_MS - (Date.now() - shownAt.current));
    const id = setTimeout(() => router.replace(dest), wait);
    return () => clearTimeout(id);
  }, [mode, profile.onboarded, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-brand px-6 text-forest">
      <div className="splash-in flex flex-col items-center gap-5">
        <LogoMark className="h-28 w-28 drop-shadow-sm" />
        <span className="text-4xl font-bold tracking-tight">Health Here</span>
      </div>
    </div>
  );
}
