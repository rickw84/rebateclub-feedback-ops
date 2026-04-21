# Deployment Guide

This app is now prepared to run as a hosted Next.js web app with a real Postgres database.

## Recommended stack

- Hosting: Vercel
- Database: Supabase Postgres
- Source control: GitHub

## Before you deploy

1. Push this project to a GitHub repository.
2. Create a Supabase project.
3. Copy your Supabase Postgres connection string.
4. Create a Vercel project connected to the GitHub repo.

## Environment variables

Set these in Vercel:

```env
DATABASE_URL=postgresql://...
ALLOW_LIVE_FALLBACK=false
```

Use a real pooled Postgres connection string for `DATABASE_URL`.

## Initialize the database

Run this from your local machine after `DATABASE_URL` points at Supabase:

```powershell
npm run db:generate
npm run db:push
npm run db:seed
```

This will:

- generate Prisma Client
- create the schema in Postgres
- seed the imported payout and participant history

## Deploy flow

1. Push the latest code to GitHub.
2. In Vercel, import the repo.
3. Add the environment variables.
4. Deploy.
5. Open the deployed app URL and test:
   - `/`
   - `/admin`
   - `/admin/participants`
   - `/admin/payouts`
   - `/portal`

## Important production note

The local JSON live-store is meant for local development only. In production, keep:

```env
ALLOW_LIVE_FALLBACK=false
```

That ensures the app uses Postgres instead of trying to fall back to local file-backed storage.

## Current limitations before wider team rollout

- Auth is still a demo cookie-based scaffold.
- Team members should not rely on the current role picker for real access control.
- The next production-hardening step should be real authentication plus role-based access.
