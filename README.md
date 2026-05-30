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
create table public.tracker_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tracker_data enable row level security;

create policy "Users can read own tracker"
on public.tracker_data
for select
using (auth.uid() = user_id);

create policy "Users can insert own tracker"
on public.tracker_data
for insert
with check (auth.uid() = user_id);

create policy "Users can update own tracker"
on public.tracker_data
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

3. In Supabase, open `Project Settings` > `API` and copy:
   - Project URL
   - anon public key
4. In Vercel, open the project settings and add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. In Supabase, open `Authentication` > `URL Configuration` and add your Vercel URL to the allowed redirect URLs.
6. Redeploy the Vercel project.

Use the `Cloud Sync` box in the stats tab to email yourself a login link. Use the same email on every device.

Use the `export backup` button occasionally as an extra safety net.
