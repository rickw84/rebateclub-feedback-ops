# Payment Tracker Import Guide

## What this does

This importer reads the Google Sheet CSV export of the legacy payment tracker and converts it into a normalized JSON bundle aligned to the Prisma schema.

Input:

- one denormalized CSV where a participant record can span multiple product rows

Output:

- organizations
- users
- participant profiles
- campaigns
- products
- campaign-product links
- applications
- assignments
- submissions
- payout batches
- payouts

## Files

- Script: `scripts/import_payment_tracker.py`
- Sample input used for validation: `data/payment-tracker.csv`
- Latest normalized output: `outputs/payment-tracker-import.json`

## Run command

```powershell
& 'C:\Users\ricw5\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  'C:\Users\ricw5\Documents\Codex\2026-04-20-i-want-to-create-a-project\scripts\import_payment_tracker.py' `
  --input 'C:\Users\ricw5\Documents\Codex\2026-04-20-i-want-to-create-a-project\data\payment-tracker.csv' `
  --output 'C:\Users\ricw5\Documents\Codex\2026-04-20-i-want-to-create-a-project\outputs\payment-tracker-import.json'
```

## How the importer maps the sheet

### Participant fields

- `Name` -> `User.name`, `ParticipantProfile.displayName`
- `Email` -> `User.email`
- `Paypal` -> `ParticipantProfile.paypalEmail`
- `Status` -> participant risk and active state

### Campaign fields

- `Newsletter Campaign` -> `Campaign.name`

Each unique newsletter/source label becomes one imported legacy campaign.

### Product fields

- `Brand` -> `Product.brandName`
- `Product` -> `Product.title`
- `Product Link` -> `Product.amazonUrl`
- product URL -> parsed ASIN when available

### Assignment fields

- one product line becomes one `Assignment`
- `Request Date` -> `Application.appliedAt`
- `Full Payment Date` -> `Assignment.assignedAt`
- `Status` -> `Assignment.status`
- `Billed to the Client?` -> `Assignment.clientBillingLabel`
- `Newsletter Campaign` -> `Assignment.sourceLabel`
- `Product Cost` -> `Assignment.purchaseSubtotal`
- inferred tax difference -> `Assignment.taxAdjustmentAmount`
- `Comments` -> `Assignment.internalNotes`

### Submission fields

- `Review Product Link` -> `Submission.externalLinks.legacyReviewUrl`

Historical review URLs are imported only as legacy proof links for migration/reference.

### Payout fields

- one actual payment event becomes one `PayoutBatch`
- `Total Product Cost + PP Fee` -> base `PayoutBatch.totalAmount`
- `PP Fee` -> base `PayoutBatch.totalFeeAmount`
- `Full Payment Date` -> base `PayoutBatch.fullPaymentDate`
- `Total Commission` -> bonus `PayoutBatch.totalAmount`
- `Commission Payment Made` -> bonus `PayoutBatch.fullPaymentDate`

Each batch is then split into assignment-level `Payout` records.

## Important importer behavior

- Continuation rows are grouped under the preceding participant row.
- Billing labels on continuation rows are preserved per assignment.
- When the sheet total is higher than the visible product subtotal, the difference is carried into `taxAdjustmentAmount`.
- Commission payouts are distributed across the assignments that have legacy proof links. If none exist, the importer falls back to all assignments in the group.

## Latest validation result

Validated against the current shared CSV export with:

- 462 grouped tracker records
- 193 participant profiles
- 790 assignments
- 783 payout batches
- 1336 payouts
- 0 import warnings
