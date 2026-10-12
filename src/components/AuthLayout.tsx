"use client";

import { MapPin, ShieldCheck, Siren } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Logo } from "./Logo";
import { EmergencyButton } from "./EmergencyButton";

/** Phone: single column. Desktop: brand panel on the left, form card on the right. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useApp();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand p-8 text-forest md:flex md:flex-col lg:p-12">
        <Logo size="lg" />
        <div className="my-auto max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">{t("tagline")}</h2>
          <ul className="mt-10 space-y-6">
            <Feature icon={<MapPin />} title={t("slide1Title")} body={t("slide1Body")} />
            <Feature icon={<ShieldCheck />} title={t("slide2Title")} body={t("slide2Body")} />
            <Feature icon={<Siren />} title={t("slide3Title")} body={t("slide3Body")} />
          </ul>
        </div>
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-forest/10" />
      </aside>
      <main className="flex min-h-dvh flex-col items-center bg-card px-5 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))] sm:justify-center md:bg-surface md:px-8 md:pb-10 lg:px-10">
        <div className="w-full max-w-md md:card md:p-8 md:shadow-sm lg:p-10">{children}</div>
      </main>
      <EmergencyButton />
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest text-brand [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-forest/80">{body}</span>
      </span>
    </li>
  );
}
