"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { LogoMark } from "@/components/Logo";

// Splash: routes people to the right place once we know who they are.
export default function Splash() {
  const { mode, profile } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (mode === "loading") return;
    if (mode === "none") router.replace("/welcome");
    else router.replace(profile.onboarded ? "/home" : "/onboarding");
  }, [mode, profile.onboarded, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand text-forest">
      <LogoMark className="h-20 w-20" />
      <span className="text-3xl font-semibold tracking-tight">Health Here</span>
    </div>
  );
}
