"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LocateFixed, MessageSquare, Phone, Share2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AppShell } from "@/components/AppShell";
import { PlaceCard } from "@/components/PlaceCard";
import { usePlaces } from "@/lib/usePlaces";
import { formatAccuracy } from "@/lib/geo";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#e9eee6]" />,
});

// Works for everyone — signed in, guest, or not signed in at all.
export default function EmergencyPage() {
  return (
    <AppShell requireProfile={false}>
      <Emergency />
    </AppShell>
  );
}

function Emergency() {
  const { t, profile, location, locationAccuracy, locStatus, requestDeviceLocation, deviceLocationOn } = useApp();
  const [address, setAddress] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data, loading, scanning } = usePlaces("er", "", location, profile.insurance);
  // In an emergency, nearest first — not "best match".
  const ers = [...(data?.places ?? [])].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 5);

  // Ask for location right away if we don't have it — every second counts here.
  useEffect(() => {
    if (!location && locStatus === "idle" && deviceLocationOn) requestDeviceLocation();
  }, [location, locStatus, requestDeviceLocation, deviceLocationOn]);

  useEffect(() => {
    if (!location) return;
    fetch(`/api/geocode?lat=${location.lat}&lng=${location.lng}&lang=${profile.language}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAddress(d?.label ?? ""))
      .catch(() => setAddress(""));
  }, [location, profile.language]);

  const coords = location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : null;
  const mapLink = location ? `https://maps.google.com/?q=${location.lat},${location.lng}` : "";
  const msg = `I need help. My location: ${address ? address + " " : ""}(${coords}) ${mapLink}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 lg:px-8 lg:py-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-8">
        {/* Actions */}
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold text-sos-dark">{t("emergency")}</h1>
          <a href="tel:911" className="flex min-h-24 items-center justify-center gap-3 rounded-3xl bg-sos text-3xl font-bold text-white shadow-lg transition hover:bg-sos-dark active:scale-[0.99]">
            <Phone className="h-9 w-9" aria-hidden /> {t("call911")}
          </a>
          <p className="text-center font-medium">{t("call911Note")}</p>

          <section className="card p-4">
            <h2 className="text-sm font-semibold text-muted">{t("yourLocation")}</h2>
            {location ? (
              <>
                {address !== "" && <p className="mt-1 text-xl font-semibold leading-snug">{address ?? "…"}</p>}
                <p className={address ? "mt-1 font-mono text-sm text-muted" : "mt-1 font-mono text-xl font-semibold"}>{coords}</p>
                {locationAccuracy != null && (
                  <p className={`mt-1 text-xs ${locationAccuracy > 500 ? "font-semibold text-warn" : "text-muted"}`}>
                    {locationAccuracy > 500 ? t("approxWarn", { d: formatAccuracy(locationAccuracy, profile.language) }) : t("accurateTo", { d: formatAccuracy(locationAccuracy, profile.language) })}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={`sms:911?&body=${encodeURIComponent(msg)}`} className="btn-ghost !min-h-12 text-sm">
                    <MessageSquare className="h-4 w-4" aria-hidden /> Text 911
                  </a>
                  <a href={`sms:?&body=${encodeURIComponent(msg)}`} className="btn-ghost !min-h-12 text-sm">
                    <Share2 className="h-4 w-4" aria-hidden /> {t("shareLocation")}
                  </a>
                </div>
                <p className="mt-2 text-xs text-muted">Text-to-911 isn&apos;t available everywhere. Call if you can.</p>
              </>
            ) : (
              <button className="btn-primary mt-3 w-full" onClick={() => requestDeviceLocation()}>
                <LocateFixed className="h-5 w-5" aria-hidden /> {locStatus === "locating" ? t("locating") : t("allowLocation")}
              </button>
            )}
          </section>

          <section className="card p-4">
            <h2 className="font-semibold">{t("whileWaiting")}</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted">
              <li>{t("wait1")}</li>
              <li>{t("wait2")}</li>
              <li>{t("wait3")}</li>
            </ol>
          </section>
        </div>

        {/* Nearest ERs */}
        <div className="mt-6 flex flex-col gap-3 lg:mt-0">
          <h2 className="text-xl font-semibold">{t("nearestER")}</h2>
          {data?.source === "sample" && <p className="rounded-xl bg-[#fff4e0] px-3 py-2 text-xs text-warn">{t("sampleData")}</p>}
          {location && (
            <div className="card h-64 overflow-hidden lg:h-80">
              <MapView center={location} accuracy={locationAccuracy} places={ers} activeId={activeId} onSelect={setActiveId} variant="er" className="h-full w-full" />
            </div>
          )}
          {loading && !data && <div className="card h-32 animate-pulse bg-surface" />}
          <div className="grid gap-3 xl:grid-cols-2">
            {ers.map((p, i) => (
              <PlaceCard key={p.id} place={p} index={i} er active={p.id === activeId} onSelect={() => setActiveId(p.id)} checking={scanning.has(p.id)} photo={false} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
