# Architecture -- PLACEHOLDER

Client (Expo iOS/Android/Web) -> Supabase (Auth, Postgres+RLS, Storage, Realtime)
Client -> Vercel API (TypeScript) -> Supabase (server-only service role) and -> simulated devices (HTTP)
