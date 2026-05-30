# Career Progress Tracker

A small personal tracker for weekly interview prep, applications, mock interviews, and long-term progress.

## Run Locally

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Open the local URL shown by Vite.

## Deploy To Vercel

Use these settings:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

On Android, open the deployed URL in Chrome and use `Add to Home screen` for an app-like shortcut.

## Supabase Sync

The app works locally without Supabase, but cross-device sync needs a free Supabase project.

1. Create a Supabase project.
2. In Supabase, open `SQL Editor` and run:

```sql
drop table if exists public.tracker_data;

create table public.tracker_data (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tracker_data enable row level security;

create policy "Read shared tracker"
on public.tracker_data
for select
to anon
using (id = 'career_tracker');

create policy "Create shared tracker"
on public.tracker_data
for insert
to anon
with check (id = 'career_tracker');

create policy "Update shared tracker"
on public.tracker_data
for update
to anon
using (id = 'career_tracker')
with check (id = 'career_tracker');
```

3. In Supabase, open `Project Settings` > `API` and copy:
   - Project URL
   - anon public key
4. In Vercel, open the project settings and add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Redeploy the Vercel project.

The app uses one shared row with id `career_tracker`, so every browser/device that opens the deployed site reads and writes the same data. No email login is required.

Use the `export backup` button occasionally as an extra safety net.
