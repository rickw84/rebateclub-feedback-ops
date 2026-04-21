# Feedback Ops Starter

This is a Next.js + Prisma starter for the compliant product feedback workflow we mapped from your SOP and payment tracker.

## What is included

- App Router based Next.js app
- Prisma schema for participants, campaigns, assignments, submissions, payouts, and payout batches
- Admin dashboard starter pages
- Participant portal starter page
- CSV importer for the legacy payment tracker
- Prisma seed loader for the normalized import JSON

## Pages

- `/` overview and product direction
- `/login` demo role login
- `/admin` admin operations dashboard
- `/admin/participants` participant monitoring view
- `/admin/payouts` payout operations view
- `/portal` participant-facing workspace
- `/api/health` simple health endpoint
- `/api/dashboard` mock dashboard payload
- `/api/auth/session` demo auth session route
- `/api/campaigns` and `/api/campaigns/:id`
- `/api/participants` and `/api/participants/:id`
- `/api/assignments` and `/api/assignments/:id`
- `/api/payouts` and `/api/payouts/:id`

## Local setup

1. Install dependencies.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Generate Prisma Client with `npm run db:generate`.
4. For the current local MVP, start the app with `npm run dev`.
5. If you later attach a real Prisma database, run `npm run db:push`.

## Legacy tracker migration

1. Export the Google Sheet to CSV.
2. Run `scripts/import_payment_tracker.py` to create `outputs/payment-tracker-import.json`.
3. The local MVP reads from `outputs/live-data.json`, which auto-seeds itself from the normalized import on first use.
4. If you later attach a real database, run `npm run db:seed` to insert the normalized data into Prisma.

More detail:

- `payment-tracker-import-guide.md`
- `prisma-seed-guide.md`

## Notes

- The UI now attempts Prisma-backed queries first and falls back to a live local file store if the database is not connected yet.
- Auth is currently a lightweight cookie-based demo scaffold so pages and API routes can enforce roles before a full auth provider is added.
- The current local MVP writes interactive changes into `outputs/live-data.json`, so you can create campaigns, participants, assignments, and payouts without waiting on database infrastructure.
- Prisma and the Postgres-oriented schema remain in the project so we can move this local MVP onto a real database next.

## Deployment

See:

- `DEPLOYMENT.md`
- `GITHUB_SETUP.md`

For hosted deployment, use a real Postgres `DATABASE_URL` and set:

```env
ALLOW_LIVE_FALLBACK=false
```
