# Health Here

Mobile-first (and desktop-responsive) web app for finding doctors, specialists, hospitals and clinics near you that take your insurance, plus a one-tap emergency button (nearest ER + call 911).

**Stack:** Next.js 15 (App Router, TypeScript, Tailwind v4) · Supabase (auth + database) · Leaflet/OpenStreetMap map · Google Places API (New) for real places · Vercel hosting.

## Run it on your computer

```bash
npm install
cp .env.example .env.local   # fill in values (optional — see below)
npm run dev                  # http://localhost:3000
```

With **no** env values the app still works: guest mode + clearly-labelled **sample** places generated around your location. To test phone layout, open Chrome DevTools → device toolbar (Cmd+Shift+M).

> Location only works on `localhost` or `https://` (browser rule). To try it on your phone over Wi-Fi, deploy to Vercel or use a tunnel (e.g. `npx localtunnel --port 3000`).

## 1. Supabase (accounts + saved preferences)

1. Create a project at supabase.com.
2. **SQL Editor** → paste and run `supabase/schema.sql` (creates `profiles`, `provider_insurance`, and the `delete_my_account()` function, all with row-level security).
3. **Project Settings → API** → copy the Project URL and anon/publishable key into `.env.local`.
4. **Authentication → URL Configuration**: set Site URL to your Vercel URL and add `http://localhost:3000/**` and `https://YOUR-APP.vercel.app/**` to Redirect URLs.
5. Optional: **Authentication → Providers → Google** to turn on "Continue with Google".

## 2. Google Places (real doctors, hospitals, hours, ratings)

1. In Google Cloud Console, enable **Places API (New)** and create an API key.
2. Restrict the key to Places API (New). It is only used server-side (`/api/places`), never sent to the browser.
3. Put it in `GOOGLE_PLACES_API_KEY`. Google bills per request beyond the monthly free usage — set a budget alert.

## 3. Insurance acceptance — important

No free public API reliably says which doctor or hospital takes which plan. The app reads it from the `provider_insurance` table (`place_id` = Google place id, `insurance_id` = id from `src/lib/insurance.ts`). Places with no rows show **"Insurance not verified — call to confirm"**, and the "Takes my insurance" filter only shows verified matches. Fill the table by calling offices, from insurer directories, or later via a paid provider-network API (e.g. Ribbon Health, Turquoise, insurer FHIR provider directories).

### Website insurance check
For real places that have a website, the server reads their homepage and insurance/billing pages (max 6 pages, respects robots.txt, public sites only) and looks for plan names. Cards then say **"Aetna is listed on their website"** with a link to the page, or **"isn't listed — call to confirm"**. This is a strong hint, not a guarantee: sites go out of date and often list carriers without saying which specific plans. Results are cached for 30 days in the `insurance_scans` table when `SUPABASE_SERVICE_ROLE_KEY` is set (otherwise only while the server is running).

## 4. GitHub + Vercel

```bash
git init && git add . && git commit -m "Health Here MVP"
git branch -M main
git remote add origin https://github.com/YOUR-USER/health-here.git
git push -u origin main
```

On vercel.com → **Add New Project** → import the repo → add the same three env variables → Deploy.

## What's where

| Path | What it does |
|---|---|
| `src/app/welcome` | Intro slides → Sign in / Sign up / Continue as guest |
| `src/app/auth` | Login + sign-up (email/password, Google), forgot/reset password |
| `src/app/onboarding` | Name → insurance → language → location |
| `src/app/home` | Locator: hospitals & clinics / doctors by specialty, filters, list + map |
| `src/app/emergency` | Call 911, your address for the dispatcher, text location, nearest ERs (no login needed) |
| `src/app/settings` | Edit profile, insurance, language, accessibility, sign out, **delete account** |
| `src/context/AppContext.tsx` | Who's signed in, profile save/load (Supabase or guest session), location |
| `src/app/api/places` | Google Places search (or sample data) + insurance matching |
| `src/app/api/geocode` | City/ZIP → coordinates, coordinates → address (OpenStreetMap Nominatim) |
| `src/lib/i18n.ts` | English / Español / 한국어 text |
| `supabase/schema.sql` | Database tables, security rules, delete-account function |

**Guest mode** keeps the profile only in this browser tab (`sessionStorage`); it's gone when the tab closes, and nothing is sent to the database.
