# Banat Connect — new app (v1.1.0)

Free, female-only learning portal for Islamic institutes: live classes,
after-class chat, announcements, digital library, attendance and
assignments. No phone numbers anywhere — login is by name + email only.

Live site: https://banat-app.vercel.app — NOTE: the Vercel project
`banat-app` is still connected to the OLD repo (`Banat-App`). It does NOT
auto-deploy from this repo yet. To serve this new app, import this repo
(`sheikh-arqam/Banat-Connect-App`) as a Vercel project (same Import flow
as before) — then Vercel auto-deploys from this repo's `main` branch.

## What is in this version

- **Front page first**: the approved BANAT banner (Bismillah), one Continue
  button. No pattern on the front page.
- **Email login**: full name + email + Student / Teacher. Females only.
  Demo one-tap logins: **Demo Teacher** and **Demo Student**, code
  `DEMO-2026`. Five demo classes: DEMO-2026 / QURAN / ARABIC / TAJWEED /
  ISLAMIC.
- **Brown Meezan theme only** (brown + soft cream). One transparent Meezan
  corner flower, upper-right corner only, grey lattice lines, one per
  screen, never on the front page. Flat buttons, no 3D.
- **Chats**: text + ticks, emoji picker, photo/file attach, camera photo,
  voice notes (records in-page where the mic is allowed; where it is not,
  an audio picker opens so a recording can still be sent as a voice note).
- **Live class**: Jitsi video room embedded, one room per class
  (`meet.jit.si/BanatConnectClass<classId>`), Start video button, new-tab
  fallback link, participants + hand raise, in-class chat.
- **Announcements, library** (real file upload up to 8 MB, plus links),
  **attendance** with saved records, **assignments** (student submission +
  teacher grading), **settings** toggles that persist, **logout** in the
  header and in Settings.
- Phase 2 is NOT built (exams/results, fee payment, parent dashboard,
  notifications) — no fake buttons for these.

## Sync (shared database) — Supabase

The app syncs its state through Supabase when configured. Without it, the
app runs in **clearly-labelled temporary local mode**: everything works,
but data saves only in that browser and does not sync. Nothing fakes sync.

To turn sync on:

1. Create a free project at https://supabase.com (a Banat project — do
   NOT reuse the Huffaz project).
2. Supabase SQL Editor → run `supabase/schema.sql` from this repo.
3. Vercel → project `banat-app` → Settings → Environment Variables →
   add `VITE_SUPABASE_URL` (Project URL) and `VITE_SUPABASE_ANON_KEY`
   (anon public key) → Redeploy.
4. Never use the `service_role` key in the app or Vercel.

## Local dev

```sh
npm install
npm run build   # tsc + vite build
npm run dev
```

## Android (test APK only)

`android/` is a WebView shell (package `com.binmuhammadart.banatconnect`)
that loads https://banat-app.vercel.app/. Build with `android/build.sh`.
Debug-signed test builds only — not a Play Store release.
