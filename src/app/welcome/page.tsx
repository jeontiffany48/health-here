"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LogIn, MapPin, ShieldCheck, Siren, UserPlus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AuthLayout } from "@/components/AuthLayout";
import { Logo } from "@/components/Logo";
import { LANGUAGES } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n";

const SLIDES: { icon: React.ReactNode; title: DictKey; body: DictKey; tint: string }[] = [
  { icon: <MapPin className="h-16 w-16" />, title: "slide1Title", body: "slide1Body", tint: "bg-brand/60" },
  { icon: <ShieldCheck className="h-16 w-16" />, title: "slide2Title", body: "slide2Body", tint: "bg-[#dfe8ff]" },
  { icon: <Siren className="h-16 w-16 text-sos" />, title: "slide3Title", body: "slide3Body", tint: "bg-[#fde3e3]" },
];

export default function Welcome() {
  const { t, mode, profile, startGuest, updateProfile, exitGuest } = useApp();
  const router = useRouter();
  const [i, setI] = useState(0);

  const startingGuest = useRef(false);
  useEffect(() => {
    if (mode === "user") router.replace(profile.onboarded ? "/home" : "/onboarding");
    else if (mode === "guest") {
      if (profile.onboarded) router.replace("/home");
      else if (!startingGuest.current) exitGuest(); // came back from guest onboarding (e.g. browser Back) — start over here
    }
  }, [mode, profile.onboarded, router, exitGuest]);

  const guest = () => {
    startingGuest.current = true;
    startGuest();
    router.push("/onboarding");
  };
  // "I'm new": onboarding first; creating an account is offered at the end (answers carry over).
  const newUser = () => {
    startingGuest.current = true;
    startGuest();
    router.push("/onboarding?new=1");
  };

  return (
    <AuthLayout>
      <div className="flex items-center justify-between">
        <span className="md:hidden">
          <Logo size="header" />
        </span>
        <select
          aria-label={t("language")}
          className="ml-auto rounded-lg border border-line bg-card px-2 py-2 text-sm"
          value={profile.language}
          onChange={(e) => updateProfile({ language: e.target.value as typeof profile.language })}
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop heading (logo + slides live in the side panel) */}
      <section className="hidden md:block">
        <h1 className="mt-6 text-3xl font-semibold">{t("welcomeTo")}</h1>
        <p className="mt-2 text-muted">{t("authSub")}</p>
      </section>

      {/* Two clear paths, right under the logo */}
      <div className="mt-5 grid grid-cols-1 gap-3 min-[340px]:grid-cols-2 md:mt-8">
        <button type="button" onClick={newUser} className="btn-primary !h-auto flex-col !gap-1 !py-4 text-center">
          <UserPlus className="h-6 w-6" aria-hidden />
          <span className="text-lg font-bold">{t("imNew")}</span>
          <span className="text-sm font-medium opacity-80">{t("imNewSub")}</span>
        </button>
        <Link href="/auth" className="btn-ghost !h-auto flex-col !gap-1 !py-4 text-center">
          <LogIn className="h-6 w-6" aria-hidden />
          <span className="text-lg font-bold">{t("returning")}</span>
          <span className="text-sm font-medium text-muted">{t("returningSub")}</span>
        </Link>
      </div>
      <p className="mt-3 text-center text-sm">
        <span className="text-muted">{t("orGuest")}</span>{" "}
        <button type="button" onClick={guest} className="font-semibold text-forest underline underline-offset-4">
          {t("continueGuest")}
        </button>
      </p>
      <p className="mt-1 text-center text-xs text-muted">{t("guestNote")}</p>

      {/* Phone: short intro slides, below the choices */}
      <section className="mt-6 border-t border-line pt-5 md:hidden" aria-roledescription="carousel" aria-label={t("howItWorks")}>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted">{t("howItWorks")}</p>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={() => setI((i + SLIDES.length - 1) % SLIDES.length)} className="btn-ghost !min-h-11 !w-11 shrink-0 !p-0" aria-label="Previous">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-forest [&_svg]:h-10 [&_svg]:w-10 ${SLIDES[i].tint}`}>{SLIDES[i].icon}</div>
            <h2 className="mt-3 text-lg font-semibold" aria-live="polite">
              {t(SLIDES[i].title)}
            </h2>
            <p className="mt-1 text-sm text-muted">{t(SLIDES[i].body)}</p>
          </div>
          <button type="button" onClick={() => setI((i + 1) % SLIDES.length)} className="btn-ghost !min-h-11 !w-11 shrink-0 !p-0" aria-label={t("next")}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="mt-4 flex justify-center gap-1.5">
          {SLIDES.map((_, n) => (
            <button key={n} type="button" onClick={() => setI(n)} aria-label={`${n + 1} / ${SLIDES.length}`} className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-forest" : "w-1.5 bg-line"}`} />
          ))}
        </div>
      </section>
    </AuthLayout>
  );
}
