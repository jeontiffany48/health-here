"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AuthLayout } from "@/components/AuthLayout";
import { getSupabase } from "@/lib/supabase/client";

export default function Reset() {
  const { t } = useApp();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const valid = pw.length >= 8 && /\d/.test(pw) && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && pw === pw2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = (await getSupabase()?.auth.updateUser({ password: pw })) ?? { error: null };
    if (error) setError(error.message);
    else router.replace("/home");
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold lg:text-3xl">{t("resetTitle")}</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <label className="field">
          <Lock className="h-5 w-5 text-muted" aria-hidden />
          <input required type="password" autoComplete="new-password" placeholder={t("newPassword")} aria-label={t("newPassword")} value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label className="field">
          <Lock className="h-5 w-5 text-muted" aria-hidden />
          <input required type="password" autoComplete="new-password" placeholder={t("confirmPassword")} aria-label={t("confirmPassword")} value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        <p className="text-sm text-muted">
          {t("pwRule8")} · {t("pwRuleNum")} · {t("pwRuleCase")}
        </p>
        {error && <p role="alert" className="rounded-xl bg-[#fde3e3] p-3 text-sm text-sos-dark">{error}</p>}
        <button className="btn-primary" disabled={!valid}>
          {t("savePassword")}
        </button>
      </form>
    </AuthLayout>
  );
}
