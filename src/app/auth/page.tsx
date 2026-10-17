"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AuthLayout } from "@/components/AuthLayout";
import { InstallApp } from "@/components/InstallApp";
import { Logo } from "@/components/Logo";
import { getEmailLinkClient, getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function AuthPage() {
  return (
    <Suspense>
      <AuthInner />
    </Suspense>
  );
}

function AuthInner() {
  const { t, mode, profile, refreshSession, exitGuest } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<"login" | "signup">(params.get("tab") === "signup" ? "signup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") === "link" ? t("linkInvalid") : null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "user") router.replace(profile.onboarded ? "/home" : "/onboarding");
  }, [mode, profile.onboarded, router]);

  const rules = [
    { ok: pw.length >= 8, label: t("pwRule8") },
    { ok: /\d/.test(pw), label: t("pwRuleNum") },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: t("pwRuleCase") },
  ];
  const signupValid = name.trim() && email && rules.every((r) => r.ok) && pw === pw2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === "guest") exitGuest(); // signing in replaces the temporary guest profile
    if (tab === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) setError(error.message);
      else await refreshSession();
    } else {
      const { data, error } = await getEmailLinkClient()!.auth.signUp({
        email,
        password: pw,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) setError(error.message);
      else if (data.session) {
        // "Confirm email" is off in Supabase: we're signed in right away.
        await sb.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
        await refreshSession();
      }
      else {
        setNotice(t("checkEmail"));
        setTab("login");
      }
    }
    setBusy(false);
  }

  async function google() {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/` } });
  }

  return (
    <AuthLayout>
      <div className="flex justify-center md:justify-start">
        <Logo size="header" />
      </div>
      <h1 className="mt-6 text-center text-2xl font-semibold md:text-left lg:text-3xl">{t("welcomeTo")}</h1>
      <p className="mt-1 text-center text-muted md:text-left">{t("authSub")}</p>

      <div className="mt-6 grid grid-cols-2 border-b border-line" role="tablist">
        {(["login", "signup"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k);
              setError(null);
            }}
            className={`min-h-12 border-b-2 font-medium transition ${tab === k ? "border-forest text-forest" : "border-transparent text-muted"}`}
          >
            {k === "login" ? t("signIn") : t("signUp")}
          </button>
        ))}
      </div>

      {!supabaseConfigured && (
        <p className="mt-5 rounded-xl bg-[#fff4e0] p-3 text-sm text-warn">
          {t("authUnavailable")}{" "}
          <Link href="/welcome" className="font-semibold underline">
            {t("continueGuest")}
          </Link>
        </p>
      )}

      <button type="button" onClick={google} disabled={!supabaseConfigured} className="btn-ghost mt-5 w-full">
        <GoogleG /> {t("continueGoogle")}
      </button>
      <p className="my-4 text-center text-sm text-muted">{t("orEmail")}</p>

      <form onSubmit={submit} className="flex flex-col gap-3">
        {tab === "signup" && (
          <label className="field">
            <UserRound className="h-5 w-5 text-muted" aria-hidden />
            <input required autoComplete="name" placeholder={t("yourName")} aria-label={t("yourName")} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label className="field">
          <Mail className="h-5 w-5 text-muted" aria-hidden />
          <input required type="email" name="email" autoComplete="username" inputMode="email" placeholder={t("email")} aria-label={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <Lock className="h-5 w-5 text-muted" aria-hidden />
          <input
            required
            type={show ? "text" : "password"}
            name="password"
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            placeholder={t("password")}
            aria-label={t("password")}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="text-muted">
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </label>
        {tab === "signup" && (
          <>
            <label className="field">
              <Lock className="h-5 w-5 text-muted" aria-hidden />
              <input required type={show ? "text" : "password"} autoComplete="new-password" placeholder={t("confirmPassword")} aria-label={t("confirmPassword")} value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </label>
            <ul className="space-y-1 text-sm">
              {rules.map((r) => (
                <li key={r.label} className={`flex items-center gap-2 ${r.ok ? "text-ok" : "text-muted"}`}>
                  <Check className="h-4 w-4" aria-hidden /> {r.label}
                </li>
              ))}
              {pw2 && pw !== pw2 && <li className="text-sos">{t("pwMismatch")}</li>}
            </ul>
          </>
        )}
        {tab === "login" && (
          <Link href="/auth/forgot" className="self-start text-sm font-medium text-forest underline underline-offset-4">
            {t("forgotPassword")}
          </Link>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-[#fde3e3] p-3 text-sm text-sos-dark">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-brand/40 p-3 text-sm text-forest">
            {notice}
          </p>
        )}
        <button type="submit" className="btn-primary mt-2" disabled={busy || !supabaseConfigured || (tab === "signup" && !signupValid)}>
          {tab === "login" ? t("signIn") : t("signUp")}
        </button>
      </form>

      <Link href="/welcome" className="btn mt-3 w-full text-muted">
        {t("back")}
      </Link>
      <InstallApp className="mt-4 border-t border-line pt-4" />
    </AuthLayout>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
