# SOP Analysis and App Mapping

## What the SOP currently does

The SOP describes an admin workflow that:

1. Sends email newsletters for product opportunities.
2. Verifies new participants by collecting PayPal info and Amazon profile screenshots.
3. Records participant selections for product baskets.
4. Sends upfront PayPal payments.
5. Tracks follow-up and completion in a spreadsheet.
6. Pays extra commission after "verified reviews" are confirmed.
7. Removes non-responsive participants from the email list.

## Useful operational requirements we can turn into software

These parts map well into a SaaS platform:

- participant intake and verification
- participant profile management
- campaign and product assignment
- status tracking across each assignment
- payout tracking
- reminder and follow-up workflows
- participant trust/risk scoring
- audit trail of every payment and action

## Risky or non-compliant parts we should not build as-is

The SOP includes practices that should not be implemented directly:

- paying people specifically for Amazon reviews
- paying extra commission per review
- conditioning payment on whether a review was posted
- requiring "verified reviews" as the payout trigger
- using PayPal "friends & family" for business operations
- scoring users based on whether they complete public reviews

## Safer product version

We should reframe this as a product testing and feedback operations platform.

That means:

- campaigns ask participants to test products and submit feedback deliverables
- submissions can include surveys, screenshots, photos, videos, receipts, or usage feedback
- optional public review activity is not required, not incentivized, and not scored
- payouts are released for approved deliverables only

## Real workflow the app should support

### 1. Participant verification

Capture:

- full name
- email
- PayPal email
- country / marketplace
- profile screenshot or identity evidence
- notes from admin review
- verification status

Statuses:

- new
- pending_review
- verified
- rejected
- blocked

### 2. Campaign setup

Capture:

- campaign name
- client
- product group / basket
- ASIN
- product title
- marketplace
- reward amount
- required deliverables
- participant limits
- deadlines

### 3. Application and assignment

Flow:

- participant browses open opportunities
- participant selects eligible products
- system checks prior participation and duplicate-product rules
- admin approves assignment
- assignment is created with due dates

Statuses:

- applied
- approved
- assigned
- in_progress
- submitted
- approved_submission
- rejected_submission
- closed

### 4. Submission review

Capture:

- submission timestamp
- attachments
- structured questionnaire answers
- admin notes
- approval decision
- revision requests

### 5. Payout operations

Track:

- base reimbursement amount
- approved bonus amount if you use non-review deliverables
- PayPal recipient
- payout batch id / reference
- fees
- payment proof
- payout status

Statuses:

- pending
- queued
- sent
- paid
- failed
- disputed

### 6. Follow-up automation

The current SOP relies on weekly manual filtering. The app should automate:

- reminder schedules
- overdue assignment detection
- non-response counters
- participant suppression rules

### 7. Participant trust / quality score

The SOP’s trust-sign logic can become a scorecard based on:

- response rate
- on-time completion
- successful submissions
- dispute history
- profile consistency
- repeated non-response
- admin flags

Do not score based on positive sentiment or public review completion.

## Recommended modules

### Admin portal

- dashboard
- participants
- verification queue
- campaigns
- products
- assignments
- submission review
- payouts
- follow-ups
- audit log

### Participant portal

- signup and onboarding
- profile verification
- available campaigns
- assigned products
- deliverable submission
- payout history
- support messages

## Spreadsheet-to-database mapping

Your existing payment tracker likely becomes:

- participants table
- participant_verifications table
- campaigns table
- products table
- assignments table
- submissions table
- payouts table
- communications table
- audit_logs table

## Highest-value MVP

If we only build the most valuable first version, it should do:

1. Admin creates campaign and products.
2. Participant applies for products.
3. Admin approves and assigns.
4. Participant submits required deliverables.
5. Admin approves submission.
6. System records or sends PayPal payout.
7. Dashboard updates participant score and status.

## Immediate next artifacts we can create

- detailed user flows
- database schema
- admin dashboard wireframe
- participant portal wireframe
- Next.js starter project
