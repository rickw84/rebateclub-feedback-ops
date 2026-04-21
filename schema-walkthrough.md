# Schema Walkthrough

## How this maps to your SOP

### Participant verification

Use:

- `User`
- `ParticipantProfile`
- `Communication`

This replaces the Gmail plus Google Form verification process. The participant profile stores PayPal email, marketplace, screenshot reference, verification status, and risk signals.

### Campaign and product setup

Use:

- `Campaign`
- `Product`
- `CampaignProduct`

This replaces the email campaign spreadsheet and basket logic. A campaign can include multiple products, `basketCode` can represent groupings like A, B, or other offer bundles, and `Product.brandName` preserves the brand field from your tracker.

### Product selection and approval

Use:

- `Application`
- `Assignment`

`Application` captures what the participant asked for. `Assignment` is the approved working record with due dates, reward amount, follow-up counters, and workflow status.

### Deliverable review

Use:

- `Submission`

This replaces the manual proof-checking process. It stores questionnaire answers, file attachments, external links, review notes, and the approval decision.

### PayPal tracking

Use:

- `PayoutBatch`
- `Payout`

This replaces the payment tracker rows for money movement. `PayoutBatch` captures one actual PayPal send event, which may cover multiple product assignments in a single payment. `Payout` stores the assignment-level accounting details such as amount, fees, recipient email, provider references, proof image, failure reason, and payout status.

## Fields added from the payment tracker

After reviewing the sheet, these tracker concepts are now represented directly:

- `Assignment.sourceLabel` for values like newsletter wave or campaign label
- `Assignment.clientBillingLabel` for entries like "Billed to ..."
- `Assignment.purchaseSubtotal` for product-level cost before adjustments
- `Assignment.taxAdjustmentAmount` for tax or reimbursement top-ups
- `Assignment.miscAdjustmentAmount` for other manual adjustments
- `PayoutBatch.fullPaymentDate` for one real payment event date
- `PayoutBatch.totalAmount` for the full PayPal send amount
- `PayoutBatch.totalFeeAmount` for total PayPal fee on that payment event
- `PayoutBatch.notes` for tracker comments or exceptions

### Follow-ups and support

Use:

- `Communication`

This logs reminder emails, support replies, and template-based outreach like verification requests, assignment notices, payout confirmations, and follow-ups.

### Oversight and reporting

Use:

- `AuditLog`

This gives you a reliable history of who changed what and when, which is especially important once multiple admins are using the system.

## Key workflow statuses

### Verification

- `NEW`
- `PENDING_REVIEW`
- `VERIFIED`
- `REJECTED`
- `BLOCKED`

### Application

- `APPLIED`
- `APPROVED`
- `REJECTED`
- `WITHDRAWN`

### Assignment

- `ASSIGNED`
- `IN_PROGRESS`
- `SUBMITTED`
- `NEEDS_REVISION`
- `APPROVED`
- `REJECTED`
- `OVERDUE`
- `CANCELED`

### Submission

- `PENDING`
- `APPROVED`
- `REJECTED`
- `NEEDS_REVISION`

### Payout

- `DRAFT`
- `QUEUED`
- `SENT`
- `PAID`
- `FAILED`
- `REVERSED`
- `DISPUTED`
- `CANCELED`

## Best next build step

With this schema in place, the next most useful artifact is either:

1. a Next.js app scaffold with Prisma wired in
2. screen-by-screen wireframes for the admin dashboard and participant portal
3. seed data and example flows for one full campaign
