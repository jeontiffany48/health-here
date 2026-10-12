"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AppShell } from "@/components/AppShell";
import { LocationPicker } from "@/components/LocationPicker";
import { InsurancePicker } from "@/components/InsurancePicker";
import { LANGUAGES } from "@/lib/i18n";

export default function SettingsPage() {
  return (
    <AppShell>
      <Settings />
    </AppShell>
  );
}

function Settings() {
  const { t, mode, email, profile, updateProfile, signOut, exitGuest, deleteAccount } = useApp();
  const router = useRouter();
  const [name, setName] = useState(profile.fullName);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => setName(profile.fullName), [profile.fullName]);

  const flash = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };
  const save = async (patch: Parameters<typeof updateProfile>[0]) => {
    await updateProfile(patch);
    flash();
  };

  async function doDelete() {
    setDeleting(true);
    setDeleteError(null);
    const err = await deleteAccount();
    setDeleting(false);
    if (err) setDeleteError(err);
    else router.replace("/welcome");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 lg:px-8 lg:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t("settings")}</h1>
        <span role="status" className={`text-sm font-medium text-ok transition ${savedFlash ? "opacity-100" : "opacity-0"}`}>
          {t("saved")} ✓
        </span>
      </div>
      {mode === "guest" && (
        <p className="mt-4 rounded-xl bg-[#fff4e0] p-3 text-sm text-warn">
          {t("guestBanner")}{" "}
          <Link href="/auth?tab=signup" className="font-semibold underline">
            {t("createAccount")}
          </Link>
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Section title={t("profile")}>
          {email && <p className="mb-3 text-sm text-muted">{email}</p>}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save({ fullName: name.trim() });
            }}
          >
            <label className="field flex-1">
              <input aria-label={t("yourName")} placeholder={t("yourName")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <button className="btn-primary" disabled={!name.trim() || name.trim() === profile.fullName}>
              {t("save")}
            </button>
          </form>
        </Section>

        <Section title={t("insurance")}>
          <InsurancePicker value={profile.insurance} onChange={(id) => save({ insurance: id })} maxHeight="16rem" />
        </Section>

        <Section title={t("language")}>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map((l) => (
              <button key={l.id} className="chip justify-center" aria-pressed={profile.language === l.id} onClick={() => save({ language: l.id })}>
                {l.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("accessibility")}>
          <Toggle label={t("largeText")} checked={profile.largeText} onChange={(v) => save({ largeText: v })} />
          <Toggle label={t("highContrast")} checked={profile.highContrast} onChange={(v) => save({ highContrast: v })} />
        </Section>

        <div id="location" className="md:col-span-2">
          <Section title={t("obLocTitle")}>
            <p className="mb-3 text-sm text-muted">{t("obLocBody")}</p>
            <LocationPicker />
          </Section>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {mode === "user" ? (
          <button
            className="btn-ghost"
            onClick={async () => {
              await signOut();
              router.replace("/welcome");
            }}
          >
            <LogOut className="h-5 w-5" aria-hidden /> {t("signOut")}
          </button>
        ) : (
          <button
            className="btn-ghost"
            onClick={() => {
              exitGuest();
              router.replace("/welcome");
            }}
          >
            <LogOut className="h-5 w-5" aria-hidden /> {t("exitGuest")}
          </button>
        )}
      </div>

      {mode === "user" && (
        <section className="mt-8 rounded-2xl border-2 border-sos/30 bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-sos-dark">
            <Trash2 className="h-5 w-5" aria-hidden /> {t("deleteAccount")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("deleteWarn")}</p>
          <label className="field mt-4">
            <input aria-label={t("typeDelete")} placeholder={t("typeDelete")} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoCapitalize="characters" autoComplete="off" />
          </label>
          {deleteError && (
            <p role="alert" className="mt-2 text-sm text-sos-dark">
              {deleteError}
            </p>
          )}
          <button className="btn-danger mt-3 w-full" disabled={confirmText !== "DELETE" || deleting} onClick={doDelete}>
            {t("deleteConfirm")}
          </button>
        </section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-forest" : "bg-line"}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-7" : "left-1"}`} />
      </button>
    </label>
  );
}
