"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, Save, UserRound } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AuthLayout } from "@/components/AuthLayout";
import { LocationPicker } from "@/components/LocationPicker";
import { Loading } from "@/components/AppShell";
import { InsurancePicker } from "@/components/InsurancePicker";
import { LANGUAGES } from "@/lib/i18n";

const TOTAL = 4;

export default function Onboarding() {
  return (
    <Suspense fallback={<Loading />}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const { t, mode, profile, updateProfile, exitGuest } = useApp();
  const router = useRouter();
  const isNew = useSearchParams().get("new") === "1" && mode === "guest";
  const [step, setStep] = useState(1);
  const [saveStep, setSaveStep] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (mode === "none") router.replace("/welcome");
    else if (isNew && profile.onboarded) setSaveStep(true); // came back from the sign-up screen
    else if ((mode === "user" || mode === "guest") && profile.onboarded && !saveStep) router.replace("/home");
  }, [mode, profile.onboarded, router, saveStep, isNew]);

  useEffect(() => {
    if (profile.fullName && !name) setName(profile.fullName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.fullName]);

  if (mode === "loading" || mode === "none") return <Loading />;

  async function next() {
    if (step === 1) await updateProfile({ fullName: name.trim() });
    if (step < TOTAL) setStep(step + 1);
    else if (isNew) {
      // New here: answers are done — offer to save them with an account.
      setSaveStep(true);
      await updateProfile({ onboarded: true });
    } else {
      await updateProfile({ onboarded: true });
      router.replace("/home");
    }
  }

  if (saveStep)
    return (
      <AuthLayout>
        <section className="text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-brand/60 text-forest">
            <Save className="h-10 w-10" aria-hidden />
          </span>
          <h1 className="mt-5 text-2xl font-semibold">{t("saveTitle", { name: profile.fullName.split(" ")[0] || "" })}</h1>
          <p className="mx-auto mt-2 max-w-sm text-muted">{t("saveBody")}</p>
        </section>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/auth?tab=signup&from=onboarding"
            className="btn-primary"
            onClick={() => {
              try {
                localStorage.setItem("hh-pending-profile", JSON.stringify({ at: Date.now(), profile: { ...profile, onboarded: true } }));
              } catch {}
            }}
          >
            {t("saveCreate")}
          </Link>
          <button type="button" className="btn mt-1 text-muted" onClick={() => router.replace("/home")}>
            {t("saveSkip")}
          </button>
          <p className="text-center text-xs text-muted">{t("guestNote")}</p>
        </div>
      </AuthLayout>
    );

  const canContinue = step === 1 ? name.trim().length > 0 : step === 2 ? Boolean(profile.insurance) : true;

  return (
    <AuthLayout>
      <div className="flex items-center gap-3">
        {(step > 1 || mode === "guest") && (
          <button
            className="btn-ghost !min-h-11 !px-3"
            onClick={() => {
              if (step > 1) return setStep(step - 1);
              exitGuest(); // first step: leave guest mode and return to the welcome screen
              router.replace("/welcome");
            }}
            aria-label={t("back")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex-1">
          <p className="text-sm text-muted">{t("stepOf", { n: step, total: TOTAL })}</p>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-forest" : "bg-line"}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 min-h-[22rem]">
        {step === 1 && (
          <section>
            <h1 className="text-2xl font-semibold">{t("obNameTitle")}</h1>
            <label className="field mt-6">
              <UserRound className="h-5 w-5 text-muted" aria-hidden />
              <input autoFocus autoComplete="name" placeholder={t("yourName")} aria-label={t("yourName")} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && canContinue && next()} />
            </label>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-2xl font-semibold">{t("obInsTitle")}</h1>
            <p className="mt-1 text-muted">{t("obInsBody")}</p>
            <div className="mt-5">
              <InsurancePicker value={profile.insurance} onChange={(id) => updateProfile({ insurance: id })} maxHeight="min(24rem, 45dvh)" />
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="text-2xl font-semibold">{t("obLangTitle")}</h1>
            <div className="mt-5 grid gap-2" role="radiogroup" aria-label={t("language")}>
              {LANGUAGES.map((l) => (
                <OptionButton key={l.id} selected={profile.language === l.id} onClick={() => updateProfile({ language: l.id })} label={l.label} />
              ))}
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <h1 className="text-2xl font-semibold">{t("obLocTitle")}</h1>
            <p className="mb-5 mt-1 text-muted">{t("obLocBody")}</p>
            <LocationPicker />
          </section>
        )}
      </div>

      <button className="btn-primary mt-6 w-full" disabled={!canContinue} onClick={next}>
        {step === TOTAL ? t("finish") : t("continue")}
      </button>
      {mode === "guest" && <p className="mt-3 text-center text-xs text-muted">{t("guestNote")}</p>}
    </AuthLayout>
  );
}

function OptionButton({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex min-h-12 items-center justify-between rounded-xl border px-4 text-left font-medium transition ${selected ? "border-forest bg-brand/40 text-forest" : "border-line bg-card hover:bg-surface"}`}
    >
      {label}
      {selected && <Check className="h-5 w-5" aria-hidden />}
    </button>
  );
}
