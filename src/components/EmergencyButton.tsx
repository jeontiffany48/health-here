"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut, Settings, Siren, Stethoscope } from "lucide-react";
import { useApp } from "@/context/AppContext";

/** Signs out an account, or ends guest mode, then returns to the welcome screen. */
export function useLogOut() {
  const { mode, signOut, exitGuest } = useApp();
  const router = useRouter();
  return async () => {
    if (mode === "user") await signOut();
    else exitGuest();
    router.replace("/welcome");
  };
}

/**
 * The big red circle, always reachable.
 * Phone: centered in a bottom bar (Home · Doctors · ER · Settings · Log out when `withNav`).
 * Desktop: a red pill fixed at the bottom-right.
 */
export function EmergencyButton({ withNav = false }: { withNav?: boolean }) {
  const { t, mode } = useApp();
  const path = usePathname();
  const logOut = useLogOut();
  const onEmergency = path === "/emergency";
  const signedIn = mode === "user" || mode === "guest";

  const circle = (
    <Link
      href="/emergency"
      aria-label={`${t("emergency")} — ${t("call911")}`}
      aria-current={onEmergency ? "page" : undefined}
      className={`${onEmergency ? "" : "sos-pulse"} -mt-6 flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-full bg-sos text-white shadow-xl ring-4 ring-white transition hover:bg-sos-dark`}
    >
      <Siren className="h-7 w-7" aria-hidden />
      <span className="mt-0.5 text-xs font-bold leading-none">{t("erShort")}/911</span>
    </Link>
  );

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label={t("menu")}
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-[repeat(5,minmax(0,1fr))] items-center px-1">
          {withNav ? (
            <>
              <BarItem href="/home" active={path === "/home"} icon={<Home className="h-6 w-6" />} label={t("home")} />
              <BarItem href="/find/doctors" active={path === "/find/doctors"} icon={<Stethoscope className="h-6 w-6" />} label={t("navDoctors")} />
              <div className="flex justify-center">{circle}</div>
              <BarItem href="/settings" active={path === "/settings"} icon={<Settings className="h-6 w-6" />} label={t("settings")} />
              {signedIn ? <BarItem onClick={logOut} icon={<LogOut className="h-6 w-6" />} label={t("logOut")} /> : <span />}
            </>
          ) : (
            <div className="col-span-5 flex justify-center">{circle}</div>
          )}
        </div>
      </nav>

      {!onEmergency && (
        <Link
          href="/emergency"
          aria-label={`${t("emergency")} — ${t("call911")}`}
          className="sos-pulse fixed bottom-8 right-8 z-[1000] hidden items-center gap-2 rounded-full bg-sos px-6 py-4 font-bold text-white shadow-xl ring-4 ring-white transition hover:bg-sos-dark md:flex"
        >
          <Siren className="h-6 w-6" aria-hidden /> {t("emergency")} · 911
        </Link>
      )}
    </>
  );
}

function BarItem({ href, onClick, active = false, icon, label }: { href?: string; onClick?: () => void; active?: boolean; icon: React.ReactNode; label: string }) {
  const cls = `flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium leading-tight ${active ? "text-forest" : "text-muted"}`;
  return href ? (
    <Link href={href} aria-current={active ? "page" : undefined} className={cls}>
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
