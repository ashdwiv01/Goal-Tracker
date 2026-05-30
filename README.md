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

The app stores progress in the browser's `localStorage`. On Android, open the deployed URL in Chrome and use `Add to Home screen` for an app-like shortcut.

Use the `export backup` button in the stats tab occasionally so your tracker data is not only tied to one browser.
