-- Health Here — run this once in Supabase → SQL Editor.

-- 1. One profile row per user. Deleted automatically when the user is deleted.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  insurance text not null default '',
  language text not null default 'en' check (language in ('en', 'es', 'ko')),
  location_mode text not null default 'device' check (location_mode in ('device', 'manual')),
  manual_location jsonb,                -- { "lat": .., "lng": .., "label": ".." }
  large_text boolean not null default false,
  high_contrast boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 2. Which insurance plans a place accepts. place_id = Google Places id.
--    Public read; only you (via the dashboard / service role) can write.
create table if not exists public.provider_insurance (
  place_id text not null,
  insurance_id text not null,
  source text,                          -- where this came from, e.g. 'called office 2026-10-11'
  verified_at timestamptz not null default now(),
  primary key (place_id, insurance_id)
);

alter table public.provider_insurance enable row level security;

drop policy if exists "anyone can read provider insurance" on public.provider_insurance;
create policy "anyone can read provider insurance" on public.provider_insurance
  for select using (true);

-- 3. "Delete my account": a signed-in user can delete only themselves.
--    Runs with elevated rights so no service-role key is needed in the app.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 4. Cache of insurance plans found on each place's own website (filled by the app's server).
--    Public read; written only by the server with the service-role key.
create table if not exists public.insurance_scans (
  place_id text primary key,
  website text not null,
  plans text[] not null default '{}',
  found_insurance_page boolean not null default false,
  source_url text,
  checked_at timestamptz not null default now()
);

alter table public.insurance_scans enable row level security;

drop policy if exists "anyone can read insurance scans" on public.insurance_scans;
create policy "anyone can read insurance scans" on public.insurance_scans
  for select using (true);

-- 5. Starred (saved) places. Only Google's place ID is stored; details are looked up fresh.
create table if not exists public.favorites (
  user_id uuid not null references auth.users on delete cascade,
  place_id text not null,
  kind text not null check (kind in ('facility', 'doctor', 'er')),
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

alter table public.favorites enable row level security;

drop policy if exists "Users manage their own favorites" on public.favorites;
create policy "Users manage their own favorites" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
