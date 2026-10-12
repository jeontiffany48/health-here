"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, List, Map as MapIcon, Stethoscope } from "lucide-react";
import { LocationBar } from "./LocationBar";
import { useApp } from "@/context/AppContext";
import { PlaceCard } from "./PlaceCard";
import { SPECIALTIES, insuranceLabel } from "@/lib/insurance";
import { usePlaces } from "@/lib/usePlaces";
import type { DictKey } from "@/lib/i18n";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#e9eee6]" />,
});

type Kind = "facility" | "doctor";

/** Locator screen for one kind of place. Always has a clear way back to the home dashboard. */
export function Locator({ kind, initialSpecialty }: { kind: Kind; initialSpecialty?: string }) {
  const { t, profile, location, locationAccuracy, locStatus } = useApp();
  const router = useRouter();
  const [specialty, setSpecialty] = useState<string>(
    SPECIALTIES.some((s) => s.id === initialSpecialty) ? initialSpecialty! : SPECIALTIES[0].id,
  );
  const [inNetwork, setInNetwork] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [sort, setSort] = useState<"distance" | "rating">("distance");
  const [view, setView] = useState<"list" | "map">("list");
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, loading, error, retry, scanning } = usePlaces(kind, kind === "doctor" ? specialty : "", location, profile.insurance);

  const places = useMemo(() => {
    let list = data?.places ?? [];
    if (inNetwork) list = list.filter((p) => p.insuranceStatus === "accepted" || p.insuranceStatus === "website_listed");
    if (openNow) list = list.filter((p) => p.openNow === true);
    if (sort === "rating") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return list;
  }, [data, inNetwork, openNow, sort]);

  const select = (id: string) => {
    setActiveId(id);
    document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="flex flex-col lg:h-full">
      {/* Controls */}
      <div className="border-b border-line bg-card px-4 pb-4 pt-4 lg:px-8 lg:pt-6">
        <div className="flex items-center gap-3">
          <Link href="/home" className="btn-ghost !min-h-12 !px-3" aria-label={t("backHome")}>
            <ArrowLeft className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">{t("backHome")}</span>
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold lg:text-3xl">
            {kind === "facility" ? <Building2 className="h-7 w-7 text-forest" aria-hidden /> : <Stethoscope className="h-7 w-7 text-forest" aria-hidden />}
            {kind === "facility" ? t("facilities") : t("doctors")}
          </h1>
        </div>
        {profile.insurance && <p className="mt-2 text-sm text-muted">{`${t("yourPlan")}: ${insuranceLabel(profile.insurance)}`}</p>}
        <LocationBar className="mt-3 lg:max-w-2xl" />

        {kind === "doctor" && (
          <label className="field mt-3 lg:w-80">
            <span className="sr-only">{t("specialty")}</span>
            <select
              value={specialty}
              onChange={(e) => {
                setSpecialty(e.target.value);
                router.replace(`/find/doctors?specialty=${encodeURIComponent(e.target.value)}`, { scroll: false });
              }}
              aria-label={t("specialty")}
            >
              {SPECIALTIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.key as DictKey)}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          <button className="chip" aria-pressed={inNetwork} onClick={() => setInNetwork(!inNetwork)} disabled={!profile.insurance}>
            {t("inNetworkOnly")}
          </button>
          <button className="chip" aria-pressed={openNow} onClick={() => setOpenNow(!openNow)}>
            {t("openNow")}
          </button>
          <button className="chip" aria-pressed={sort === "rating"} onClick={() => setSort(sort === "rating" ? "distance" : "rating")}>
            {sort === "rating" ? t("sortRating") : t("sortDistance")}
          </button>
        </div>
        {/* Phone only: switch between list and map */}
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 lg:hidden" role="tablist" aria-label={`${t("list")} / ${t("map")}`}>
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-lg font-semibold transition ${view === v ? "bg-card text-forest shadow-sm" : "text-muted"}`}
            >
              {v === "list" ? <List className="h-5 w-5" aria-hidden /> : <MapIcon className="h-5 w-5" aria-hidden />}
              {v === "list" ? t("list") : t("map")}
            </button>
          ))}
        </div>
      </div>

      {/* Results: phone = list OR map; desktop = list + map side by side */}
      {!location ? (
        <div className="m-4 card p-6 text-center lg:m-8">
          <p className="text-muted">{locStatus === "locating" ? t("locating") : t("needLocation")}</p>
        </div>
      ) : (
        <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(22rem,30rem)_1fr]">
          <section className={`${view === "list" ? "block" : "hidden"} px-4 py-4 lg:block lg:overflow-y-auto lg:px-6 lg:pb-28`} aria-live="polite">
            {data?.source === "sample" && <p className="mb-3 rounded-xl bg-[#fff4e0] px-3 py-2 text-xs text-warn">{t("sampleData")}</p>}
            {error ? (
              <div className="card p-6 text-center">
                <p className="text-muted">{t("loadError")}</p>
                <button className="btn-primary mt-4" onClick={retry}>
                  {t("retry")}
                </button>
              </div>
            ) : loading && !data ? (
              <SkeletonList />
            ) : (
              <>
                <p className="mb-3 text-sm text-muted">{t("results", { n: places.length })}</p>
                {places.length === 0 ? (
                  <p className="card p-6 text-center text-muted">{t("noResults")}</p>
                ) : (
                  <div className={`flex flex-col gap-3 transition-opacity ${loading ? "opacity-50" : ""}`}>
                    {places.map((p, i) => (
                      <PlaceCard key={p.id} place={p} index={i} active={p.id === activeId} onSelect={() => setActiveId(p.id)} checking={scanning.has(p.id)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
          <section className={`${view === "map" ? "block" : "hidden"} h-[calc(100dvh-24rem)] min-h-[20rem] md:h-[calc(100dvh-16rem)] lg:block lg:h-full`} aria-label={t("map")}>
            <MapView center={location} accuracy={locationAccuracy} places={places} activeId={activeId} onSelect={select} className="h-full w-full" />
          </section>
        </div>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-40 animate-pulse bg-surface" />
      ))}
    </div>
  );
}
