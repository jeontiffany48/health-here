"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { translate, type DictKey } from "@/lib/i18n";
import { DEFAULT_PROFILE, type LatLng, type Profile } from "@/lib/types";

type Mode = "loading" | "none" | "guest" | "user";
type LocStatus = "idle" | "locating" | "ok" | "denied" | "unavailable";

type Ctx = {
  mode: Mode;
  email: string | null;
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  startGuest: () => void;
  exitGuest: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
  location: LatLng | null;
  locationLabel: string | null;
  /** Device accuracy in meters (null = typed address, which is exact). */
  locationAccuracy: number | null;
  locStatus: LocStatus;
  requestDeviceLocation: () => Promise<boolean>;
  /** Guests confirm their location every time the app opens; accounts reuse their saved choice. */
  needsLocationPrompt: boolean;
  confirmLocation: () => void;
  /** When the current location was last saved (it's reused for 7 days to avoid repeat lookups). */
  locationSavedAt: number | null;
  /** Device location switch. Off = the app never reads GPS; searches use a typed address. */
  deviceLocationOn: boolean;
  turnOffDeviceLocation: () => Promise<void>;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
};

const AppContext = createContext<Ctx | null>(null);

const GUEST_KEY = "hh-guest-profile";
export const RETURNING_KEY = "hh-has-account";
const PENDING_KEY = "hh-pending-profile"; // onboarding answers waiting for a new account (1 day)
const LANG_KEY = "hh-lang"; // language picked before signing in (not personal data)

type Row = {
  full_name: string;
  insurance: string;
  language: Profile["language"];
  location_mode: Profile["locationMode"];
  manual_location: Profile["manualLocation"];
  large_text: boolean;
  high_contrast: boolean;
  onboarded: boolean;
};

const toRow = (p: Profile): Row => ({
  full_name: p.fullName,
  insurance: p.insurance,
  language: p.language,
  location_mode: p.locationMode,
  manual_location: p.manualLocation,
  large_text: p.largeText,
  high_contrast: p.highContrast,
  onboarded: p.onboarded,
});

const fromRow = (r: Partial<Row>): Profile => ({
  fullName: r.full_name ?? "",
  insurance: r.insurance ?? "",
  language: r.language ?? "en",
  locationMode: r.location_mode ?? "device",
  manualLocation: r.manual_location ?? null,
  largeText: r.large_text ?? false,
  highContrast: r.high_contrast ?? false,
  onboarded: r.onboarded ?? false,
});

function safeGet(store: "local" | "session", key: string) {
  try {
    return (store === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function safeSet(store: "local" | "session", key: string, value: string | null) {
  try {
    const s = store === "local" ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* storage blocked — app still works in memory */
  }
}


// ---- Saved location (this device only, 7 days) ----
const SAVED_LOC_KEY = "hh-saved-location";
const SAVED_LOC_DAYS = 7;
type SavedLocation = LatLng & { accuracy: number | null; label: string | null; savedAt: number };

function readSavedLocation(): SavedLocation | null {
  const raw = safeGet("local", SAVED_LOC_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SavedLocation;
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return null;
    if (Date.now() - s.savedAt > SAVED_LOC_DAYS * 86400_000) return null; // expired: ask again
    return s;
  } catch {
    return null;
  }
}
function writeSavedLocation(loc: Omit<SavedLocation, "savedAt">): SavedLocation | null {
  const prev = readSavedLocation();
  const moved = !prev || Math.abs(prev.lat - loc.lat) > 0.0005 || Math.abs(prev.lng - loc.lng) > 0.0005;
  if (!moved && prev && prev.label === loc.label) return null;
  const next = { ...loc, savedAt: moved || !prev ? Date.now() : prev.savedAt };
  safeSet("local", SAVED_LOC_KEY, JSON.stringify(next));
  return next;
}
function clearSavedLocation() {
  safeSet("local", SAVED_LOC_KEY, null);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading");
  // Remember this device has an account, so next time we go straight to sign-in (not the intro slides).
  useEffect(() => {
    if (mode === "user") safeSet("local", RETURNING_KEY, "1");
  }, [mode]);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [deviceLoc, setDeviceLoc] = useState<(LatLng & { accuracy: number }) | null>(null);
  const watchRef = useRef<number | null>(null);
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  // Location is saved on this device for 7 days, so people aren't asked (and searches can repeat
  // from the same spot, which lets results be reused) until it expires or they tap "Change".
  const [savedLoc, setSavedLoc] = useState<SavedLocation | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  useEffect(() => {
    const s = readSavedLocation();
    if (s) {
      setSavedLoc(s);
      setLocationConfirmed(true);
      setLocStatus("ok");
    }
  }, []);
  const confirmLocation = useCallback(() => setLocationConfirmed(true), []);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const loadUser = useCallback(async () => {
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.auth.getUser();
      if (data.user) {
        setEmail(data.user.email ?? null);
        setUserId(data.user.id);
        const { data: row } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
        const metaName = (data.user.user_metadata?.full_name as string | undefined) ?? "";
        // New account made right after onboarding as a guest: keep those answers.
        // (also kept briefly in localStorage, for an email-confirmation link that opens in a new tab)
        let pendingProfile: string | null = null;
        try {
          const pending = JSON.parse(safeGet("local", PENDING_KEY) ?? "null");
          if (pending && Date.now() - pending.at < 86_400_000) pendingProfile = JSON.stringify(pending.profile);
        } catch {}
        const guestRaw = safeGet("session", GUEST_KEY) ?? pendingProfile;
        const guestProfile = guestRaw ? ({ ...DEFAULT_PROFILE, ...JSON.parse(guestRaw) } as Profile) : null;
        safeSet("session", GUEST_KEY, null); // signed in now — the temporary guest profile is done
        safeSet("local", PENDING_KEY, null);
        if (!row && guestProfile?.onboarded) {
          const carried = { ...guestProfile, fullName: guestProfile.fullName || metaName };
          await sb.from("profiles").upsert({ id: data.user.id, ...toRow(carried), updated_at: new Date().toISOString() });
          setProfile(carried);
        } else setProfile(row ? fromRow(row) : { ...DEFAULT_PROFILE, fullName: metaName, language: (safeGet("local", LANG_KEY) as Profile["language"]) || "en" });
        setMode("user");
        return;
      }
    }
    setEmail(null);
    setUserId(null);
    const guest = safeGet("session", GUEST_KEY);
    if (guest) {
      setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(guest) });
      setMode("guest");
    } else {
      setProfile({ ...DEFAULT_PROFILE, language: (safeGet("local", LANG_KEY) as Profile["language"]) || "en" });
      setMode("none");
    }
  }, []);

  useEffect(() => {
    loadUser();
    const sb = getSupabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") loadUser();
    });
    return () => data.subscription.unsubscribe();
  }, [loadUser]);

  // iPhone home-screen app: Google sign-in finishes in a browser sheet on top of the app.
  // When the person taps "Done" and comes back, pick up the new login right away.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible" && modeRef.current !== "user") loadUser();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, [loadUser]);

  // Accessibility + language applied to the whole document.
  useEffect(() => {
    const html = document.documentElement;
    html.lang = profile.language;
    html.dataset.largeText = String(profile.largeText);
    html.dataset.contrast = profile.highContrast ? "high" : "normal";
  }, [profile.language, profile.largeText, profile.highContrast]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const next = { ...profileRef.current, ...patch };
      setProfile(next);
      if (patch.language) safeSet("local", LANG_KEY, patch.language);
      if (mode === "guest") {
        safeSet("session", GUEST_KEY, JSON.stringify(next));
      } else if (mode === "user" && userId) {
        const sb = getSupabase();
        await sb?.from("profiles").upsert({ id: userId, ...toRow(next), updated_at: new Date().toISOString() });
      }
    },
    [mode, userId],
  );

  const startGuest = useCallback(() => {
    const p = { ...DEFAULT_PROFILE, language: profileRef.current.language };
    safeSet("session", GUEST_KEY, JSON.stringify(p));
    setProfile(p);
    setMode("guest");
  }, []);

  const exitGuest = useCallback(() => {
    setLocationConfirmed(false);
    safeSet("session", GUEST_KEY, null);
    setProfile({ ...DEFAULT_PROFILE, language: profileRef.current.language });
    setDeviceLoc(null);
    setLocStatus("idle");
    setMode("none");
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    setDeviceLoc(null);
    setLocStatus("idle");
    await loadUser();
  }, [loadUser]);

  const deleteAccount = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return "Accounts are not configured.";
    const { error } = await sb.rpc("delete_my_account");
    if (error) return error.message;
    await sb.auth.signOut();
    setDeviceLoc(null);
    await loadUser();
    return null;
  }, [loadUser]);

  /**
   * Precise location: keeps listening for up to 12 s and keeps the most accurate reading
   * (phones switch from Wi-Fi/cell estimates to GPS within a few seconds). Resolves on the first fix
   * so the app can start searching right away; later, clearly better readings replace it.
   */
  const requestDeviceLocation = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setLocStatus("unavailable");
        return resolve(false);
      }
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      setLocStatus("locating");
      let best: (LatLng & { accuracy: number }) | null = null;
      let settled = false;
      const stop = () => {
        if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      };
      const timer = setTimeout(() => {
        stop();
        if (!settled) {
          settled = true;
          setLocStatus(best ? "ok" : "unavailable");
          resolve(Boolean(best));
        }
      }, 12000);
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const reading = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) };
          // Only replace the current fix when the new one is clearly more precise (avoids re-searching on every tiny update).
          if (!best || reading.accuracy < best.accuracy * 0.6) {
            best = reading;
            setDeviceLoc(reading);
          }
          if (!settled) {
            settled = true;
            setLocStatus("ok");
            resolve(true);
          }
          if (reading.accuracy <= 25) {
            clearTimeout(timer);
            stop();
          }
        },
        (err) => {
          if (best) return; // keep what we have
          clearTimeout(timer);
          stop();
          settled = true;
          setLocStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    });
  }, []);

  useEffect(() => () => {
    if (watchRef.current != null) navigator.geolocation?.clearWatch(watchRef.current);
  }, []);

  // Once a profile is ready, get the device location automatically if that's the chosen mode.
  useEffect(() => {
    // Accounts only, and only when there's no saved location from the last 7 days.
    if (mode === "user" && profile.onboarded && profile.locationMode === "device" && locStatus === "idle" && !savedLoc) {
      requestDeviceLocation();
    }
  }, [mode, profile.onboarded, profile.locationMode, locStatus, requestDeviceLocation, savedLoc]);

  const manual = profile.locationMode === "manual" ? profile.manualLocation : null;
  const saved = profile.locationMode === "device" || mode === "guest" ? savedLoc : null;
  const location = manual ? { lat: manual.lat, lng: manual.lng } : deviceLoc ?? saved ?? profile.manualLocation ?? null;
  const locationLabel = manual?.label ?? (deviceLoc ? null : saved?.label ?? profile.manualLocation?.label ?? null);
  const locationAccuracy = manual ? null : deviceLoc ? deviceLoc.accuracy : saved ? saved.accuracy : null;
  const locationSavedAt = !manual && !deviceLoc && saved ? saved.savedAt : null;

  // Save whatever location is in use (keeps the original date if it hasn't moved, so 7 days really means 7 days).
  useEffect(() => {
    if (!location || !(locationConfirmed || mode === "user")) return;
    const next = writeSavedLocation({ lat: location.lat, lng: location.lng, accuracy: locationAccuracy, label: locationLabel });
    if (next) setSavedLoc(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng, locationConfirmed, mode]);

  const needsLocationPrompt =
    profile.onboarded &&
    ((mode === "guest" && !locationConfirmed) ||
      // accounts: only when we truly have no location (e.g. permission was turned off)
      (mode === "user" && !location && (profile.locationMode === "manual" || locStatus === "denied" || locStatus === "unavailable")));

  const deviceLocationOn = profile.locationMode === "device";
  // "Off" is stored as locationMode = "manual" (with or without a saved address), so no database change is needed.
  const turnOffDeviceLocation = useCallback(async () => {
    if (watchRef.current != null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null;
    setDeviceLoc(null);
    clearSavedLocation();
    setSavedLoc(null);
    setLocStatus("idle");
    await updateProfile({ locationMode: "manual" });
  }, [updateProfile]);

  const t = useCallback((key: DictKey, vars?: Record<string, string | number>) => translate(profile.language, key, vars), [profile.language]);

  const value = useMemo<Ctx>(
    () => ({
      mode,
      email,
      profile,
      updateProfile,
      startGuest,
      exitGuest,
      signOut,
      deleteAccount,
      refreshSession: loadUser,
      location: location ? { lat: location.lat, lng: location.lng } : null,
      locationLabel,
      locationAccuracy,
      locStatus: manual ? "ok" : locStatus,
      requestDeviceLocation,
      needsLocationPrompt,
      confirmLocation,
      locationSavedAt,
      deviceLocationOn,
      turnOffDeviceLocation,
      t,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, email, profile, updateProfile, startGuest, exitGuest, signOut, deleteAccount, loadUser, location?.lat, location?.lng, locationLabel, locationAccuracy, locStatus, manual, requestDeviceLocation, needsLocationPrompt, confirmLocation, locationSavedAt, deviceLocationOn, turnOffDeviceLocation, t],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
