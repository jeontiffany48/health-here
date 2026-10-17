"use client";

import Link from "next/link";
import { Building2, ChevronRight, ShieldCheck, Siren, Star, Stethoscope } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";
import { LocationBar } from "@/components/LocationBar";
import { useApp } from "@/context/AppContext";
import { AppShell } from "@/components/AppShell";
import { SPECIALTIES, insuranceLabel } from "@/lib/insurance";
import type { DictKey } from "@/lib/i18n";

// Home dashboard: the starting point. Each locator opens on its own page with a "Back to home" button.
export default function HomePage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const { t, profile, mode } = useApp();
  const { favorites } = useFavorites();
  const firstName = profile.fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <h1 className="text-3xl font-bold lg:text-4xl">{firstName ? t("hi", { name: firstName }) : t("hiGuest")}</h1>
      <p className="mt-1 text-lg text-muted">{t("whatLooking")}</p>

      {mode === "guest" && (
        <p className="mt-4 rounded-xl bg-[#fff4e0] px-4 py-3 text-sm text-warn">
          {t("guestBanner")}{" "}
          <Link href="/auth?tab=signup" className="font-semibold underline">
            {t("createAccount")}
          </Link>
        </p>
      )}

      {/* Main choices */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <BigCard href="/find/facilities" icon={<Building2 className="h-8 w-8" />} title={t("facilities")} body={t("facilitiesBody")} tint="bg-brand/60" />
        <BigCard href="/find/doctors" icon={<Stethoscope className="h-8 w-8" />} title={t("doctors")} body={t("doctorsBody")} tint="bg-[#dfe8ff]" />
      </div>

      {/* Saved places */}
      <Link href="/saved" className="card mt-4 flex items-center gap-3 px-5 py-4 transition hover:border-forest">
        <Star className={`h-6 w-6 shrink-0 ${favorites.length ? "fill-[#f5b301] text-[#f5b301]" : "text-muted"}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t("savedPlaces")}</span>
          <span className="block truncate text-sm text-muted">{favorites.length ? t("savedCount", { n: favorites.length }) : t("savedEmptyHint")}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
      </Link>

      {/* Specialty shortcuts */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("popularSpecialties")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => (
            <Link key={s.id} href={`/find/doctors?specialty=${encodeURIComponent(s.id)}`} className="chip !min-h-11 hover:border-forest">
              {t(s.key as DictKey)}
            </Link>
          ))}
        </div>
      </section>

      {/* Emergency + plan + location */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/emergency" className="flex items-center gap-4 rounded-2xl bg-sos p-5 text-white shadow-sm transition hover:bg-sos-dark">
          <Siren className="h-9 w-9 shrink-0" aria-hidden />
          <span>
            <span className="block text-lg font-bold">{t("erCardTitle")}</span>
            <span className="block text-sm text-white/90">{t("erCardBody")}</span>
          </span>
        </Link>
        <InfoCard icon={<ShieldCheck className="h-6 w-6" />} label={t("yourPlan")} value={profile.insurance ? insuranceLabel(profile.insurance) : t("notSet")} href="/settings" action={t("change")} />
      </div>
      <LocationBar className="mt-4" />
    </div>
  );
}

function BigCard({ href, icon, title, body, tint }: { href: string; icon: React.ReactNode; title: string; body: string; tint: string }) {
  return (
    <Link href={href} className="card group flex min-w-0 items-center gap-3 p-4 sm:gap-4 sm:p-5 transition hover:border-forest hover:shadow-md lg:p-6">
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:h-16 sm:w-16 text-forest ${tint}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-semibold [overflow-wrap:anywhere]">{title}</span>
        <span className="mt-0.5 block text-muted">{body}</span>
      </span>
      <ChevronRight className="h-6 w-6 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-forest" aria-hidden />
    </Link>
  );
}

function InfoCard({ icon, label, value, href, action }: { icon: React.ReactNode; label: string; value: string; href: string; action: string }) {
  return (
    <div className="card flex items-center gap-3 p-5">
      <span className="text-forest">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted">{label}</span>
        <span className="block truncate font-semibold">{value}</span>
      </span>
      <Link href={href} className="text-sm font-semibold text-forest underline underline-offset-4">
        {action}
      </Link>
    </div>
  );
}
