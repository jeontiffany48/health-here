"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AuthLayout } from "@/components/AuthLayout";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function Forgot() {
  const { t } = useApp();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await getSupabase()?.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    });
    setBusy(false);
    setSent(true); // same message either way, so we don't reveal which emails have accounts
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold lg:text-3xl">{t("resetTitle")}</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <label className="field">
          <Mail className="h-5 w-5 text-muted" aria-hidden />
          <input required type="email" autoComplete="email" placeholder={t("email")} aria-label={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {sent && (
          <p role="status" className="rounded-xl bg-brand/40 p-3 text-sm text-forest">
            {t("resetSent")}
          </p>
        )}
        <button className="btn-primary" disabled={busy || !supabaseConfigured}>
          {t("sendResetLink")}
        </button>
        <Link href="/auth" className="btn text-muted">
          {t("back")}
        </Link>
      </form>
    </AuthLayout>
  );
}
