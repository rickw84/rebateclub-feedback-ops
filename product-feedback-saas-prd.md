# Product Feedback SaaS PRD

## Product direction

This document reframes the idea into a safer and more buildable SaaS:

- Manage product feedback and tester campaigns for Amazon products.
- Let participants opt into products they want to test.
- Track whether the participant completed the required deliverables.
- Manage PayPal payouts for approved deliverables.
- Maintain participant profiles and quality scores.

Important constraint:

- Do not make payouts contingent on posting a public review.
- Do not reward, suppress, or score participants based on review sentiment.
- If a participant independently leaves a public review, it must be optional and outside the paid workflow.

## Core users

### 1. Admin / Brand team

Your internal team that creates campaigns, approves participants, reviews submissions, and releases payouts.

### 2. Participant

A tester, customer panelist, or content creator who applies to receive or test products and submits proof of completed deliverables.

## MVP goals

1. Create campaigns for Amazon products.
2. Allow participants to browse and apply for campaigns or specific products.
3. Review and approve participant assignments.
4. Collect proof of task completion.
5. Track payout status through PayPal.
6. Maintain participant profiles and performance scores.
7. Keep audit logs for compliance.

## Revised workflow

### 1. Campaign creation

The brand team creates a campaign with:

- campaign name
- Amazon product(s)
- product ASIN
- country / marketplace
- target participant count
- participation requirements
- deliverables
- reward amount
- start and end date
- campaign status

Example deliverables:

- submit structured private feedback
- upload product photos
- answer survey questions
- submit unboxing video link

### 2. Participant selection

Participants can:

- create a profile
- browse open campaigns
- apply to specific products
- declare interest categories and region

The brand team can:

- review applications
- approve or reject applications
- assign products
- set assignment deadlines

### 3. Submission and verification

Participants complete tasks and submit:

- survey responses
- uploaded images
- content links
- proof of purchase or receipt if required
- notes on product experience

The brand team then marks the assignment as:

- pending
- submitted
- under_review
- approved
- rejected
- needs_revision

### 4. Payout tracking

Once deliverables are approved, a payout record is created and tracked through PayPal:

- draft
- queued
- sent
- pending
- paid
- failed
- reversed

Payouts should be tied only to approved deliverables, not to whether a public review was posted or what rating was given.

### 5. Participant scoring

Each participant has a profile score based on:

- application acceptance rate
- completion rate
- on-time submission rate
- approval rate
- revision rate
- payout dispute rate
- compliance flags

Do not score on positive vs negative product opinion.

## Recommended MVP modules

### 1. Auth and roles

- email/password or magic link login
- roles: admin, manager, participant
- organization support for future multi-tenant SaaS

### 2. Campaign management

- create/edit/archive campaigns
- attach one or more products
- campaign dashboard
- quotas and deadlines

### 3. Product catalog

- product title
- ASIN
- Amazon URL
- marketplace
- image
- category

### 4. Participant portal

- participant profile
- campaign browser
- application history
- assigned products
- submission forms
- payout history

### 5. Review queue

- admin queue for submitted deliverables
- approve / reject / request revision
- internal notes

### 6. Payouts

- PayPal account email per participant
- payout queue
- payout status sync
- failure handling

### 7. Scoring and compliance

- participant scorecard
- internal risk flags
- notes and moderation history
- audit log of actions

## Suggested tech stack

For a fast SaaS MVP:

- Frontend: Next.js
- Backend: Next.js API routes or a NestJS service
- Database: PostgreSQL
- ORM: Prisma
- Auth: Auth.js or Clerk
- File storage: Supabase Storage or S3
- Payments: PayPal Payouts API
- Background jobs: Inngest or BullMQ
- Email: Resend or Postmark
- Hosting: Vercel for app, Supabase or Neon for Postgres

If you want the simplest path, use:

- Next.js
- Prisma
- PostgreSQL
- Auth.js
- S3-compatible storage
- PayPal Payouts

## Suggested data model

### users

- id
- organization_id
- role
- name
- email
- password_hash or auth_provider_id
- created_at

### organizations

- id
- name
- created_at

### participant_profiles

- id
- user_id
- display_name
- paypal_email
- country
- niches
- bio
- avatar_url
- score
- total_assignments
- completion_rate
- approval_rate
- compliance_status
- created_at

### products

- id
- organization_id
- asin
- title
- amazon_url
- marketplace
- image_url
- category
- active

### campaigns

- id
- organization_id
- name
- description
- status
- start_date
- end_date
- reward_type
- reward_amount
- max_participants
- created_by
- created_at

### campaign_products

- id
- campaign_id
- product_id
- quantity_target

### applications

- id
- campaign_id
- product_id
- participant_id
- status
- applied_at
- decision_at
- decision_by

### assignments

- id
- campaign_id
- product_id
- participant_id
- due_date
- status
- assigned_at
- approved_at

Suggested assignment statuses:

- assigned
- in_progress
- submitted
- under_review
- approved
- rejected
- canceled

### submissions

- id
- assignment_id
- submission_type
- content_json
- attachments_json
- submitted_at
- reviewed_at
- reviewed_by
- review_notes
- decision

### payouts

- id
- participant_id
- assignment_id
- amount
- currency
- paypal_payout_batch_id
- paypal_item_id
- status
- requested_at
- sent_at
- settled_at
- failure_reason

### participant_scores

- id
- participant_id
- period_start
- period_end
- completion_rate
- on_time_rate
- approval_rate
- dispute_rate
- compliance_flags
- total_score

### audit_logs

- id
- organization_id
- actor_user_id
- entity_type
- entity_id
- action
- metadata_json
- created_at

## Scoring formula for MVP

Start each participant at 70/100 and adjust monthly:

- +10 for strong on-time completion
- +10 for high approval rate
- -10 for repeated late submissions
- -15 for frequent revisions
- -20 for no-shows
- -25 for compliance issues

Score bands:

- 90-100: preferred
- 75-89: reliable
- 60-74: watchlist
- below 60: restricted

## Screens for V1

### Admin

- login
- campaign list
- campaign detail
- product manager
- applications queue
- assignments queue
- submission review page
- payouts dashboard
- participant profile view
- compliance log

### Participant

- signup/login
- onboarding/profile
- browse campaigns
- product application page
- assignment dashboard
- submission form
- payout history

## Example business rules

- A participant cannot receive payout until deliverables are approved.
- A participant can apply only once per campaign-product pair.
- Rejected applications may be re-applied only if reopened by admin.
- Late assignments automatically move to flagged status after grace period.
- Compliance-flagged participants require manual approval before new assignments.

## API sketch

### Admin endpoints

- `POST /api/campaigns`
- `GET /api/campaigns`
- `POST /api/campaigns/:id/products`
- `GET /api/applications`
- `POST /api/applications/:id/approve`
- `POST /api/applications/:id/reject`
- `POST /api/assignments/:id/review`
- `POST /api/payouts/:id/send`

### Participant endpoints

- `GET /api/campaigns/open`
- `POST /api/applications`
- `GET /api/assignments/me`
- `POST /api/submissions`
- `GET /api/payouts/me`

## Compliance-safe wording

Use language like:

- participant
- tester
- feedback contributor
- content creator
- deliverable
- approved submission

Avoid product language like:

- paid review
- review reward
- 5-star reviewer
- review completion payout

## Recommended build order

### Phase 1

- auth
- organizations
- campaigns
- products
- participant profiles

### Phase 2

- applications
- assignments
- submissions
- admin review flow

### Phase 3

- PayPal payout integration
- participant scoring
- audit logs
- notifications

## Best next step

Build a V1 focused on:

1. Admin creates campaign and products.
2. Participant applies to a product.
3. Admin approves and creates assignment.
4. Participant submits feedback deliverables.
5. Admin approves submission.
6. System creates PayPal payout.
7. Dashboard updates participant score.

## If we build this next

The fastest technical starting point is:

- Next.js app router
- PostgreSQL + Prisma
- Auth.js
- Tailwind for UI
- PayPal Payouts integration

From here, the next artifact should be either:

- a clickable MVP wireframe
- a Prisma schema
- a full Next.js starter app
