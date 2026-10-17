"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { useApp } from "@/context/AppContext";

// Google sign-in started from the iPhone home-screen app ends here. Inside the iOS browser
// sheet, <BackToApp> covers this page and tells people to tap ✕; elsewhere, just continue.
export default function SignedInDone() {
  const { mode, profile } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (mode === "loading") return;
    router.replace(mode === "user" ? (profile.onboarded ? "/home" : "/onboarding") : "/");
  }, [mode, profile.onboarded, router]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand">
      <LogoMark className="h-20 w-20" />
    </div>
  );
}
