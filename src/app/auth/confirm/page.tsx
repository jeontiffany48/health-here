"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, MailCheck } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useApp } from "@/context/AppContext";
import { AuthLayout } from "@/components/AuthLayout";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Landing page for links in emails (reset password, confirm sign-up).
 * The link carries a one-time token_hash; it's only used when the person taps the button, so:
 *  - it works in any browser/device (not just the one that requested it), and
 *  - email security scanners that "pre-click" links can't use it up.
 */
export default function ConfirmPage() {
  return (
    <Suspense>
      <Confirm />
    </Suspense>
  );
}

const NEXT_FOR: Record<string, string> = { recovery: "/auth/reset", email: "/onboarding", signup: "/onboarding", invite: "/onboarding", email_change: "/settings", magiclink: "/" };

function Confirm() {
  const { t, refreshSession } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  const type = (params.get("type") ?? "email") as EmailOtpType;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(tokenHash ? null : t("linkInvalid"));
  const isRecovery = type === "recovery";

  async function go() {
    const sb = getSupabase();
    if (!sb || !tokenHash) return;
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      setError(t("linkInvalid"));
      setBusy(false);
      return;
    }
    await refreshSession();
    router.replace(NEXT_FOR[type] ?? "/");
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/60 text-forest">
          {isRecovery ? <KeyRound className="h-7 w-7" aria-hidden /> : <MailCheck className="h-7 w-7" aria-hidden />}
        </span>
        <h1 className="mt-4 text-2xl font-semibold lg:text-3xl">{isRecovery ? t("resetTitle") : t("confirmEmailTitle")}</h1>
        <p className="mt-1 text-muted">{isRecovery ? t("confirmResetBody") : t("confirmEmailBody")}</p>
      </div>
      {error ? (
        <div className="mt-6 flex flex-col gap-3">
          <p role="alert" className="rounded-xl bg-[#fde3e3] p-3 text-sm text-sos-dark">
            {error}
          </p>
          <Link href={isRecovery ? "/auth/forgot" : "/auth"} className="btn-primary">
            {isRecovery ? t("sendResetLink") : t("signIn")}
          </Link>
        </div>
      ) : (
        <button className="btn-primary mt-6 w-full" onClick={go} disabled={busy}>
          {isRecovery ? t("continueReset") : t("confirmEmailButton")}
        </button>
      )}
    </AuthLayout>
  );
}
