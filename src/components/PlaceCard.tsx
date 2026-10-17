"use client";

import { useState } from "react";
import { Building2, ChevronDown, Clock, ExternalLink, Globe, Loader2, Navigation, Phone, ShieldAlert, ShieldCheck, ShieldQuestion, Siren, Star, Stethoscope } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatDistance } from "@/lib/geo";
import { insuranceLabel } from "@/lib/insurance";
import type { Place } from "@/lib/types";
import { liveHours, useNow } from "@/lib/hours";

export function PlaceCard({ place, index, active, onSelect, er = false, checking = false }: { place: Place; index: number; active?: boolean; onSelect?: () => void; er?: boolean; checking?: boolean }) {
  const { t, profile } = useApp();
  const now = useNow();
  const live = liveHours(place, now, profile.language);
  const todayLine = place.weekHours[live.todayIndex]?.replace(/^[^:]+:\s*/, "") ?? place.todayHours;
  const [showHours, setShowHours] = useState(false);
  const plan = insuranceLabel(profile.insurance);

  return (
    <article
      id={`place-${place.id}`}
      className={`card p-4 transition ${active ? "border-forest ring-2 ring-forest/20" : ""}`}
      onMouseEnter={onSelect}
      onFocus={onSelect}
    >
      <div className="flex gap-3">
        <PlaceThumb place={place} index={index} er={er} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{place.name}</h3>
          <p className="text-sm text-muted">
            {[place.category, place.address].filter(Boolean).join(" · ")}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium">{t("away", { d: formatDistance(place.distanceKm, profile.language) })}</span>
            {place.rating != null ? (
              <span className="inline-flex items-center gap-1" aria-label={`Rating ${place.rating} out of 5`}>
                <Star className="h-4 w-4 fill-[#f5b301] text-[#f5b301]" aria-hidden />
                <span className="font-medium">{place.rating.toFixed(1)}</span>
                {place.ratingCount != null && <span className="text-muted">({place.ratingCount})</span>}
              </span>
            ) : (
              <span className="text-muted">{t("noRating")}</span>
            )}
          </div>

          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1.5 text-left text-sm"
            onClick={() => setShowHours(!showHours)}
            aria-expanded={showHours}
            disabled={place.weekHours.length === 0}
          >
            <Clock className="h-4 w-4 text-muted" aria-hidden />
            {live.openNow == null ? (
              <span className="text-muted">{t("hoursUnknown")}</span>
            ) : (
              <span className={`font-semibold ${live.openNow ? (live.next?.soon ? "text-warn" : "text-ok") : "text-sos-dark"}`}>
                {live.always
                  ? t("open24h")
                  : live.openNow && live.next?.soon
                    ? t("closesSoon", { t: live.next.time })
                    : live.openNow
                      ? t("open")
                      : t("closed")}
              </span>
            )}
            {live.next && !live.always && !(live.openNow && live.next.soon) ? (
              <span className="text-muted">
                ·{" "}
                {live.next.kind === "closes" ? t("closesAt", { t: live.next.time }) : t("opensAt", { t: live.next.time })}
              </span>
            ) : (
              !live.always && !(live.openNow && live.next?.soon) && todayLine && <span className="text-muted">· {t("today")}: {todayLine}</span>
            )}
            {place.weekHours.length > 0 && <ChevronDown className={`h-4 w-4 text-muted transition ${showHours ? "rotate-180" : ""}`} aria-hidden />}
          </button>
          {showHours && (
            <ul className="mt-2 space-y-0.5 rounded-lg bg-surface p-2 text-xs text-muted">
              {place.weekHours.map((h, i) => (
                <li key={h} className={i === live.todayIndex ? "font-semibold text-ink" : ""}>{h}</li>
              ))}
            </ul>
          )}

          {profile.insurance && <InsuranceBadge status={place.insuranceStatus} plan={plan} checking={checking} sourceUrl={place.websiteScan?.sourceUrl ?? null} />}

          <div className="mt-3 flex gap-2">
            {place.phone && (
              <a href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} className="btn-ghost !min-h-11 flex-1 text-sm">
                <Phone className="h-4 w-4" aria-hidden /> {t("call")}
              </a>
            )}
            <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer" className={`${er ? "btn-danger" : "btn-primary"} !min-h-11 flex-1 text-sm`}>
              <Navigation className="h-4 w-4" aria-hidden /> {t("directions")}
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Numbered icon for the place (no photos — each Google photo is a paid lookup). */
function PlaceThumb({ place, index, er }: { place: Place; index: number; er: boolean }) {
  const isDoctor = /doctor|physician|dentist|^dr\.?\s/i.test(`${place.primaryType ?? ""} ${place.types.join(" ")} ${place.name}`);
  const Icon = er ? Siren : isDoctor ? Stethoscope : Building2;
  return (
    <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
      <div className={`flex h-full w-full items-center justify-center rounded-xl ${er ? "bg-[#fde3e3] text-sos" : isDoctor ? "bg-[#dfe8ff] text-forest" : "bg-brand/50 text-forest"}`}>
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <span className={`absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white ${er ? "bg-sos" : "bg-forest"}`} aria-hidden>
        {index + 1}
      </span>
    </div>
  );
}

function InsuranceBadge({ status, plan, checking, sourceUrl }: { status: Place["insuranceStatus"]; plan: string; checking: boolean; sourceUrl: string | null }) {
  const { t } = useApp();
  const pill = "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold";
  if (status === "accepted")
    return (
      <p className={`${pill} bg-[#e3f3e1] text-ok`}>
        <ShieldCheck className="h-4 w-4" aria-hidden /> {t("accepts", { plan })}
      </p>
    );
  if (status === "not_accepted")
    return (
      <p className={`${pill} bg-[#fde3e3] text-sos-dark`}>
        <ShieldAlert className="h-4 w-4" aria-hidden /> {t("notAccepts", { plan })}
      </p>
    );
  if (status === "website_listed" || status === "website_not_listed") {
    const listed = status === "website_listed";
    return (
      <div className="mt-2">
        <p className={`${pill} ${listed ? "bg-[#e3f3e1] text-ok" : "bg-[#fff4e0] text-warn"}`}>
          {listed ? <Globe className="h-4 w-4" aria-hidden /> : <ShieldQuestion className="h-4 w-4" aria-hidden />}
          {listed ? t("websiteListed", { plan }) : t("websiteNotListed", { plan })}
        </p>
        <p className="mt-1 text-[11px] text-muted">
          {t("websiteNote")}{" "}
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-forest underline">
              {t("seeSource")} <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </p>
      </div>
    );
  }
  if (checking)
    return (
      <p className={`${pill} bg-surface text-muted`} role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("checkingWebsite")}
      </p>
    );
  return (
    <p className={`${pill} bg-[#fff4e0] text-warn`}>
      <ShieldQuestion className="h-4 w-4" aria-hidden /> {t("insUnknown")}
    </p>
  );
}
