# Prisma Seed Guide

## What this seeder does

This seeder loads the normalized import JSON and inserts it into the Prisma/Postgres schema in dependency-safe order:

1. organizations
2. users
3. participant profiles
4. campaigns
5. products
6. campaign-product links
7. applications
8. assignments
9. submissions
10. payout batches
11. payouts

It uses `createMany` with `skipDuplicates: true`, so rerunning it is safe.

## Seeder file

- `scripts/seed_prisma_from_import.mjs`

## Input file

- `outputs/payment-tracker-import.json`

## Before you run it

You need a real Prisma project environment with:

- PostgreSQL available
- `DATABASE_URL` set
- Prisma schema applied to the database
- Prisma Client generated from `prisma/schema.prisma`
- `@prisma/client` installed in the project

Typical setup flow:

1. create a Node project if you have not already
2. install `prisma` and `@prisma/client`
3. run `prisma generate`
4. run `prisma db push` or your migrations
5. run the seed script

## Run command

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public"
& 'C:\Users\ricw5\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' `
  'C:\Users\ricw5\Documents\Codex\2026-04-20-i-want-to-create-a-project\scripts\seed_prisma_from_import.mjs' `
  --input 'C:\Users\ricw5\Documents\Codex\2026-04-20-i-want-to-create-a-project\outputs\payment-tracker-import.json'
```

Optional:

- `--batch-size 200`

## Expected output

The script prints counts like:

- `organizations: inserted/total`
- `users: inserted/total`
- `participantProfiles: inserted/total`
- `campaigns: inserted/total`
- `products: inserted/total`
- `campaignProducts: inserted/total`
- `applications: inserted/total`
- `assignments: inserted/total`
- `submissions: inserted/total`
- `payoutBatches: inserted/total`
- `payouts: inserted/total`

It ends with:

- `Seed complete.`

## Current limitation

I verified the script syntax locally, but I did not execute a live DB seed in this workspace because there is not yet a configured Prisma app with `@prisma/client` and a live Postgres database attached.
