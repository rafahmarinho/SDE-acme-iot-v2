# ACME IoT v2

Smart-building IoT platform (scaffold). Source spec: [`specs/PRD.md`](specs/PRD.md).

- **App:** React Native + Expo + Expo Router + TypeScript (Android, iOS, Web), light theme with indigo accents,
  navigation by organization → building → room, device cards, 3D room dashboard.
- **API:** TypeScript serverless functions on Vercel. Device communication is simulated over HTTP (no MQTT broker).
- **Backend:** Supabase (PostgreSQL, Auth email/password, Storage, Realtime). Web and mobile share one Supabase project.
- **Roles:** Owner, Administrator, Operator, Viewer.
- **Devices:** thermostats, smart plugs, temperature/humidity/occupancy sensors. QR/manual registration,
  desired vs reported state, firmware updates with progress and rollback, offline/low-battery/reconnect simulation.
- **Demo data:** two organizations, twenty devices; simulation area (scenarios, advance, events, reset).

> **Status: scaffold only.** Files contain placeholders. Implement features by following
> [`AGENTS.md`](AGENTS.md) and the per-countermeasure recipes in [`skills/`](skills/)
> (SD Elements project "ACME IoT v2", ID 34).

## Layout

```
apps/mobile      Expo app (screens in app/, components, services)
apps/api         Vercel serverless API (api/ routes, src/lib, src/middleware)
packages/shared  Shared TypeScript types, role/permission matrix, validation schemas
supabase         migrations (schema + RLS + storage policies), seed.sql (demo data)
skills           Security countermeasure recipes from SD Elements (one SKILL.md per countermeasure)
```

## Getting started (once implemented)

1. `pnpm install`
2. Copy `.env.example` to `.env` and fill **client-safe** values only; set server-only values in Vercel.
3. `supabase db push`, then load `supabase/seed.sql`.
4. `pnpm dev:api` and `pnpm dev:mobile`.

## Deploy

- Web: `npx expo export -p web` from `apps/mobile`, deploy the output to Vercel.
- API: `vercel deploy` from `apps/api`.
- Native packages: `eas build -p android` / `eas build -p ios`.
