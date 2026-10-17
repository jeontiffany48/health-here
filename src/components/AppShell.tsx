"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Home, LogOut, MapPin, Menu, Settings, Siren, Star, Stethoscope, X, UserRound, ShieldCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { insuranceLabel } from "@/lib/insurance";
import { Logo } from "./Logo";
import { EmergencyButton, useLogOut } from "./EmergencyButton";
import { LocationPicker } from "./LocationPicker";

/**
 * Layout for signed-in and guest screens.
 * Phone: top bar + slide-out menu. Desktop (lg+): permanent left sidebar.
 */
export function AppShell({ children, requireProfile = true, fullHeight = false, locationGate = true }: { children: React.ReactNode; requireProfile?: boolean; fullHeight?: boolean; locationGate?: boolean }) {
  const { mode, profile, t, needsLocationPrompt } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!requireProfile || mode === "loading") return;
    if (mode === "none") router.replace("/welcome");
    else if (!profile.onboarded) router.replace("/onboarding");
  }, [mode, profile.onboarded, requireProfile, router]);

  const logOut = useLogOut();
  const logOutButton = (mode === "user" || mode === "guest") && (
    <button type="button" onClick={logOut} className="btn-ghost mt-3 w-full">
      <LogOut className="h-5 w-5" aria-hidden /> {t("logOut")}
    </button>
  );

  const ready = !requireProfile || ((mode === "user" || mode === "guest") && profile.onboarded);

  const nav = (
    <nav className="flex flex-col gap-1" aria-label={t("menu")}>
      <NavLink href="/home" icon={<Home className="h-5 w-5" />} label={t("home")} active={path === "/home"} />
      <NavLink href="/find/facilities" icon={<Building2 className="h-5 w-5" />} label={t("facilities")} active={path === "/find/facilities"} />
      <NavLink href="/find/doctors" icon={<Stethoscope className="h-5 w-5" />} label={t("doctors")} active={path === "/find/doctors"} />
      <NavLink href="/saved" icon={<Star className="h-5 w-5" />} label={t("savedPlaces")} active={path === "/saved"} />
      <NavLink href="/emergency" icon={<Siren className="h-5 w-5 text-sos" />} label={t("emergency")} active={path === "/emergency"} />
      <NavLink href="/settings" icon={<Settings className="h-5 w-5" />} label={t("settings")} active={path === "/settings"} />
    </nav>
  );

  const summary = (mode === "user" || mode === "guest") && (
    <div className="card p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold">
        <UserRound className="h-4 w-4" /> {profile.fullName || (mode === "guest" ? "Guest" : "—")}
      </div>
      <div className="mt-1 flex items-center gap-2 text-muted">
        <ShieldCheck className="h-4 w-4" /> {profile.insurance ? insuranceLabel(profile.insurance) : t("notSet")}
      </div>
      {mode === "guest" && (
        <p className="mt-3 rounded-lg bg-surface p-2 text-xs text-muted">
          {t("guestBanner")}{" "}
          <Link href="/auth?tab=signup" className="font-semibold text-forest underline">
            {t("createAccount")}
          </Link>
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-card p-5 md:flex">
        <Link href="/home" aria-label="Health Here home" className="-mx-5 -mt-5 mb-2 flex h-24 items-center bg-brand px-5">
          <Logo size="header" />
        </Link>
        {nav}
        <div className="mt-auto">
          {summary}
          {logOutButton}
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-[900] flex min-h-20 items-center justify-between bg-brand px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm md:hidden">
        <Link href="/home" aria-label="Health Here home">
          <Logo size="header" />
        </Link>
        <button className="btn !min-h-12 !px-3 bg-white/70 text-forest hover:bg-white" onClick={() => setOpen(true)} aria-label={t("menu")} aria-expanded={open}>
          <Menu className="h-7 w-7" />
        </button>
      </header>

      {/* Phone slide-out menu */}
      {open && (
        <div className="fixed inset-0 z-[1100] md:hidden" role="dialog" aria-modal="true" aria-label={t("menu")}>
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[min(20rem,85vw)] flex-col gap-6 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{t("menu")}</span>
              <button className="btn-ghost !min-h-11 !px-3" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-6 w-6" />
              </button>
            </div>
            {nav}
            <div className="mt-auto">
          {summary}
          {logOutButton}
        </div>
          </div>
        </div>
      )}

      <main className={`min-w-0 pb-32 md:pb-28 ${fullHeight ? "lg:h-dvh lg:overflow-hidden lg:pb-0" : ""}`}>{!ready ? <Loading /> : needsLocationPrompt && locationGate && requireProfile ? <LocationGate /> : children}</main>
      <EmergencyButton withNav />
    </div>
  );
}

function NavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium transition ${active ? "bg-brand/50 text-forest" : "hover:bg-surface"}`}
    >
      {icon}
      {label}
    </Link>
  );
}

/** Asked before showing results: every visit for guests, only when needed for accounts. Never on the emergency screen. */
function LocationGate() {
  const { t, mode } = useApp();
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 md:py-16">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/60 text-forest">
        <MapPin className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold md:text-3xl">{t("whereSearch")}</h1>
      <p className="mb-6 mt-1 text-muted">{t("whereSearchBody")}</p>
      <LocationPicker />
      {mode === "guest" && <p className="mt-4 text-center text-xs text-muted">{t("guestNote")}</p>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-forest" />
    </div>
  );
}
