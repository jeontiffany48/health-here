"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ShieldCheck, Siren } from "lucide-react";
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
  const { t, mode, profile, startGuest, updateProfile } = useApp();
  const router = useRouter();
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;

  useEffect(() => {
    if (mode === "user" || mode === "guest") router.replace(profile.onboarded ? "/home" : "/onboarding");
  }, [mode, profile.onboarded, router]);

  const guest = () => {
    startGuest();
    router.push("/onboarding");
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

      {/* Phone: swipe-style intro slides */}
      <section className="mt-4 md:hidden" aria-roledescription="carousel">
        <div className={`mx-auto flex aspect-square w-full max-w-[13rem] items-center justify-center rounded-[2rem] text-forest ${SLIDES[i].tint}`}>
          {SLIDES[i].icon}
        </div>
        <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
          {SLIDES.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-forest" : "w-1.5 bg-line"}`} />
          ))}
        </div>
        <h1 className="mt-6 text-center text-2xl font-semibold" aria-live="polite">
          {t(SLIDES[i].title)}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-center text-muted">{t(SLIDES[i].body)}</p>
      </section>

      {/* Desktop heading (slides live in the side panel) */}
      <section className="hidden md:block">
        <h1 className="mt-6 text-3xl font-semibold">{t("welcomeTo")}</h1>
        <p className="mt-2 text-muted">{t("authSub")}</p>
      </section>

      <div className="mt-8 flex flex-col gap-3">
        {!last ? (
          <div className="flex flex-col gap-3 md:hidden">
            <button className="btn-primary" onClick={() => setI(i + 1)}>
              {t("next")}
            </button>
            <button className="btn-ghost" onClick={() => setI(SLIDES.length - 1)}>
              {t("skip")}
            </button>
          </div>
        ) : null}
        <div className={`flex-col gap-3 ${last ? "flex" : "hidden md:flex"}`}>
          <Link href="/auth" className="btn-primary">
            {t("signIn")}
          </Link>
          <Link href="/auth?tab=signup" className="btn-ghost">
            {t("signUp")}
          </Link>
          <button className="btn mt-2 text-forest underline underline-offset-4" onClick={guest}>
            {t("continueGuest")}
          </button>
          <p className="text-center text-xs text-muted">{t("guestNote")}</p>
        </div>
      </div>
    </AuthLayout>
  );
}
