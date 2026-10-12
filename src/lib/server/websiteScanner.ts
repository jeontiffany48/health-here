// Server-only: reads a hospital/clinic website and looks for the insurance plans it lists.
// Safety: only public http(s) hosts (no internal/private IPs), small pages, short timeouts,
// respects robots.txt, same-site links only, at most a handful of pages per site.
import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { createClient } from "@supabase/supabase-js";
import { findPlans, INSURANCE_LINK_HINT } from "@/lib/insuranceMatch";
import type { WebsiteScan } from "@/lib/types";

const UA = "HealthHereBot/0.1 (+insurance lookup for patients; respects robots.txt)";
const PAGE_TIMEOUT_MS = 6000;
const TOTAL_BUDGET_MS = 20000;
const MAX_BYTES = 1_500_000;
const MAX_PAGES = 6;
const CACHE_DAYS = 30;

// ---------- cache (memory + optional Supabase table) ----------
const memory = new Map<string, WebsiteScan>();

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && service ? createClient(url, service, { auth: { persistSession: false } }) : null;
}
function readClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && anon ? createClient(url, anon, { auth: { persistSession: false } }) : null;
}
const fresh = (s: WebsiteScan) => Date.now() - new Date(s.checkedAt).getTime() < CACHE_DAYS * 86400_000;

type ScanRow = { place_id: string; plans: string[]; found_insurance_page: boolean; source_url: string | null; checked_at: string };
const fromRow = (r: ScanRow): WebsiteScan => ({ plans: r.plans ?? [], foundInsurancePage: r.found_insurance_page, sourceUrl: r.source_url, checkedAt: r.checked_at });

/** Cached scans for many places (memory first, then the insurance_scans table). */
export async function getCachedScans(placeIds: string[]): Promise<Map<string, WebsiteScan>> {
  const out = new Map<string, WebsiteScan>();
  const missing: string[] = [];
  for (const id of placeIds) {
    const m = memory.get(id);
    if (m && fresh(m)) out.set(id, m);
    else missing.push(id);
  }
  const sb = readClient();
  if (sb && missing.length) {
    const { data } = await sb.from("insurance_scans").select("*").in("place_id", missing);
    for (const r of (data ?? []) as ScanRow[]) {
      const s = fromRow(r);
      if (fresh(s)) {
        out.set(r.place_id, s);
        memory.set(r.place_id, s);
      }
    }
  }
  return out;
}

async function saveScan(placeId: string, website: string, s: WebsiteScan) {
  memory.set(placeId, s);
  const sb = adminClient();
  if (!sb) return; // no service key: memory cache only
  await sb.from("insurance_scans").upsert({
    place_id: placeId,
    website,
    plans: s.plans,
    found_insurance_page: s.foundInsurancePage,
    source_url: s.sourceUrl,
    checked_at: s.checkedAt,
  });
}

// ---------- safe fetching ----------
function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}

// Test hook only: lets automated tests scan a local fixture site. Never enabled in production.
const allowLocal = process.env.NODE_ENV !== "production" && process.env.HH_SCANNER_ALLOW_LOCAL === "1";

async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (allowLocal && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return u;
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad protocol");
  if (u.username || u.password) throw new Error("credentials in url");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("bad port");
  const host = u.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("private host");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) throw new Error("private address");
  return u;
}

async function fetchPage(raw: string, deadline: number): Promise<{ url: string; html: string } | null> {
  let url = raw;
  for (let hop = 0; hop < 4; hop++) {
    const u = await assertPublicUrl(url);
    const timeout = Math.min(PAGE_TIMEOUT_MS, deadline - Date.now());
    if (timeout <= 0) return null;
    const res = await fetch(u, {
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeout),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, u).toString();
      continue;
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html") || !res.body) return null;
    // read at most MAX_BYTES
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      chunks.push(value);
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
    return { url: u.toString(), html: new TextDecoder().decode(Buffer.concat(chunks)) };
  }
  return null;
}

async function robotsDisallows(origin: string, deadline: number): Promise<string[]> {
  try {
    const u = await assertPublicUrl(`${origin}/robots.txt`);
    const res = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(Math.min(4000, deadline - Date.now())), cache: "no-store" });
    if (!res.ok) return [];
    const text = (await res.text()).slice(0, 200_000);
    const rules: string[] = [];
    let applies = false;
    for (const line of text.split(/\r?\n/)) {
      const [k, ...rest] = line.split(":");
      const key = k.trim().toLowerCase();
      const val = rest.join(":").trim();
      if (key === "user-agent") applies = val === "*" || /healthhere/i.test(val);
      else if (applies && key === "disallow" && val) rules.push(val);
    }
    return rules;
  } catch {
    return [];
  }
}

// ---------- parsing ----------
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>/gi, ". ")
    .replace(/<br\s*\/?>/gi, ". ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ");
}

export function insuranceLinks(html: string, base: URL): string[] {
  const out: { url: string; score: number }[] = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const baseHost = base.hostname.replace(/^www\./, "");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let u: URL;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    const host = u.hostname.replace(/^www\./, "");
    if (!(host === baseHost || host.endsWith(`.${baseHost}`) || baseHost.endsWith(`.${host}`))) continue;
    if (/\.(pdf|jpg|png|docx?|xlsx?)$/i.test(u.pathname)) continue;
    const text = htmlToText(m[2]).trim();
    const hay = `${text} ${u.pathname}`;
    if (!INSURANCE_LINK_HINT.test(hay)) continue;
    const score = (/insurance/i.test(hay) ? 3 : 0) + (/accept|plans|participat/i.test(hay) ? 2 : 0) + (/billing|financial|payment/i.test(hay) ? 1 : 0);
    u.hash = "";
    out.push({ url: u.toString(), score });
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .map((o) => o.url)
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
}

const looksLikeInsurancePage = (text: string, url: string) =>
  /insurance/i.test(url) || /(insurance (plans|carriers|companies|we accept|accepted)|accepted (insurance|plans)|plans we accept|in[- ]network|participat\w* (with|in))/i.test(text);

// ---------- main ----------
export async function scanWebsite(placeId: string, website: string): Promise<WebsiteScan> {
  const cached = (await getCachedScans([placeId])).get(placeId);
  if (cached) return cached;

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const start = await assertPublicUrl(website);
  const disallow = await robotsDisallows(start.origin, deadline);
  const allowed = (url: string) => {
    const path = new URL(url).pathname;
    return !disallow.some((d) => d !== "/" ? path.startsWith(d) : true);
  };

  const plans = new Set<string>();
  let found = false;
  let best: { url: string; n: number } | null = null;
  const visited = new Set<string>();

  const consider = (url: string, html: string) => {
    const text = htmlToText(html);
    const isIns = looksLikeInsurancePage(text, url);
    if (!isIns) return;
    found = true;
    const p = findPlans(text);
    p.forEach((x) => plans.add(x));
    if (p.length && (!best || p.length > best.n)) best = { url, n: p.length };
  };

  if (allowed(start.toString())) {
    const home = await fetchPage(start.toString(), deadline).catch(() => null);
    if (home) {
      visited.add(home.url);
      consider(home.url, home.html);
      const base = new URL(home.url);
      const candidates = [
        ...insuranceLinks(home.html, base),
        ...["/insurance", "/insurance-accepted", "/patients/insurance", "/billing/insurance", "/patients-visitors/billing-insurance"].map((p) => new URL(p, base.origin).toString()),
      ];
      for (const c of candidates) {
        if (visited.size >= MAX_PAGES || Date.now() > deadline) break;
        if (visited.has(c) || !allowed(c)) continue;
        visited.add(c);
        const page = await fetchPage(c, deadline).catch(() => null);
        if (page) consider(page.url, page.html);
      }
    }
  }

  const result: WebsiteScan = {
    plans: [...plans],
    foundInsurancePage: found,
    sourceUrl: (best as { url: string } | null)?.url ?? null,
    checkedAt: new Date().toISOString(),
  };
  await saveScan(placeId, start.toString(), result).catch(() => {});
  return result;
}
