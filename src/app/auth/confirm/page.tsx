"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useApp } from "@/context/AppContext";
import { AuthLayout } from "@/components/AuthLayout";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Landing page for links in emails (reset password, confirm sign-up). Handles every format Supabase uses:
 *  1. #access_token=…&refresh_token=…&type=recovery   (default emails; works on any device)
 *  2. ?token_hash=…&type=recovery                       (custom email templates; needs a tap, so scanners can't use it up)
 *  3. ?code=…                                           (older links; only works in the browser that asked)
 *  4. #error=…                                          (expired / already used)
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
  const [state, setState] = useState<"working" | "needsTap" | "error">("working");
  const [type, setType] = useState<string>("email");
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const isRecovery = type === "recovery";

  useEffect(() => {
    const sb = getSupabase();
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const linkType = hash.get("type") ?? query.get("type") ?? (query.get("next") === "/auth/reset" ? "recovery" : "email");
    setType(linkType);
    const finish = async () => {
      // remove tokens from the address bar / history
      window.history.replaceState(null, "", window.location.pathname);
      await refreshSession();
      router.replace(NEXT_FOR[linkType] ?? "/");
    };

    (async () => {
      if (!sb) return setState("error");
      if (hash.get("error") || query.get("error")) return setState("error");

      const access = hash.get("access_token");
      const refresh = hash.get("refresh_token");
      if (access && refresh) {
        const { error } = await sb.auth.setSession({ access_token: access, refresh_token: refresh });
        return error ? setState("error") : finish();
      }
      const code = query.get("code");
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        return error ? setState("error") : finish();
      }
      const th = query.get("token_hash");
      if (th) {
        setTokenHash(th);
        return setState("needsTap");
      }
      setState("error");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tap() {
    const sb = getSupabase();
    if (!sb || !tokenHash) return;
    setState("working");
    const { error } = await sb.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (error) return setState("error");
    window.history.replaceState(null, "", window.location.pathname);
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
        {state !== "error" && <p className="mt-1 text-muted">{isRecovery ? t("confirmResetBody") : t("confirmEmailBody")}</p>}
      </div>

      {state === "working" && (
        <div className="mt-6 flex justify-center" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-forest" aria-label="Loading" />
        </div>
      )}
      {state === "needsTap" && (
        <button className="btn-primary mt-6 w-full" onClick={tap}>
          {isRecovery ? t("continueReset") : t("confirmEmailButton")}
        </button>
      )}
      {state === "error" && (
        <div className="mt-6 flex flex-col gap-3">
          <p role="alert" className="rounded-xl bg-[#fde3e3] p-3 text-sm text-sos-dark">
            {t("linkInvalid")}
          </p>
          <Link href={isRecovery ? "/auth/forgot" : "/auth"} className="btn-primary">
            {isRecovery ? t("sendResetLink") : t("signIn")}
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
