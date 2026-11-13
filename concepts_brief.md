# RentPilot — Project Brief & Concepts Specification

* **Author:** Skanda Chandrashekar
* **Date:** 2026-11-12
* **Status:** Finalized & Approved (Project Brief)

---

## Overview

RentPilot is a cloud-based rental and property management web application built for property owners and tenants. Initially deployed for a family rental business managing approximately five residential houses (comprising multiple independent rental units), the system centralizes property configuration, tenancy agreements, scheduled percentage-based rent increments, manual variable monthly charges (electricity, water, maintenance), invoice generation, UPI payment tracking, tenant communication via email, and maintenance requests.

The application is architected from day one with multi-tenant readiness (via an `organization_id` foreign key on all core domain schemas) to support future expansion to independent landlords without structural schema rewrites. Operating with development and eligible preview deployments hosted on Vercel and utilizing managed cloud infrastructure (Supabase PostgreSQL, Firebase Auth, Supabase Storage, Brevo), RentPilot prioritizes operational reliability, data isolation, and financial idempotency over speculative features or visual excess.

---

## Analysis

### 1. Goldfish Reviewer Status

| Reviewer Lens | Persona | Status |
| :--- | :--- | :--- |
| **Hostile Design Critic** | `egm-design` | Completed |
| **Skeptical Architect** | `egm-zoom-out` | Completed |
| **Pragmatic Tech Lead** | `egm-implementation-readiness` | Completed |
| **Inventive Catalyst** | `egm-inventive-catalyst` | Completed |

---

### 2. Synthesized Challenges, Inventive Contradictions & Mitigations

#### A. Free-Tier Operational Reliability vs. 24/7 Scheduled Jobs (Resolved)
* **The Contradiction**: Supabase Free Tier automatically pauses projects after 7 consecutive days of zero inbound REST/API activity. Internal `pg_cron` executions inside PostgreSQL do not count as external API activity according to Supabase pause heuristics.
* **Agreed Resolution**:
  - Implement a scheduled external heartbeat via a GitHub Actions workflow running every 48 hours to execute an authenticated HTTPS `GET /api/system/heartbeat` call against the Vercel-deployed application. This guarantees the Supabase database remains awake.
  - Implement **Demand-Driven / Lazy Billing Evaluation**: When the owner opens the dashboard on or after the 10th of the month, the system dynamically checks for ungenerated billing cycles and presents draft batches, ensuring the workflow never depends solely on background cron execution.

#### B. Firebase Auth to Supabase RLS Bridge: Official Third-Party Auth Integration (Revalidated & Resolved)
* **Revalidation & Verification**:
  - We conducted a technical verification of Supabase's official documentation (`supabase.com/docs/guides/auth/third-party/firebase-auth`).
  - **Verdict on Custom JWT Signing**: A custom JWT signed with the Supabase secret is **NOT necessary and introduces unnecessary cryptographic risk**. Supabase provides native, first-class third-party Firebase Authentication.
* **Official Architecture**:
  1. **Supabase Third-Party Provider Configuration**: Register the Firebase Project ID directly in Supabase Authentication settings (`[auth.third_party.firebase] enabled = true, project_id = "<id>"`). Supabase's gateway natively validates incoming Firebase RS256 JWTs against Google's public JWKS.
  2. **Direct Token Ingestion**: The Supabase client accepts Firebase ID tokens directly via the official `accessToken` hook:
     ```typescript
     export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
       accessToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
     });
     ```
  3. **Role Claim & PostgreSQL RLS**: Firebase users are assigned the standard `role: 'authenticated'` custom claim. In PostgreSQL RLS policies, the Firebase UID is extracted cleanly via:
     ```sql
     (auth.jwt() ->> 'sub')
     ```
     This matches the `firebase_uid` text column in `profiles` and `organization_memberships`.
  4. **Next.js Server Components (RSC)**: For server-side queries, the Firebase session cookie or token is retrieved from `cookies()` and passed to the server Supabase client's `accessToken` callback. No custom JWT minting is performed.

#### C. Payment Verification & Fraud Prevention in Zero-Fee UPI Workflows (Resolved)
* **The Vulnerability**: Without a paid merchant gateway (e.g., Razorpay/Cashfree), tenants upload unverified payment screenshots and enter 12-digit UPI UTRs (Unique Transaction References). Careless or malicious tenants could attempt to reuse an old UTR from a previous month.
* **Agreed Resolution**:
  - Add a strict database uniqueness constraint:
    ```sql
    CREATE UNIQUE INDEX uq_payments_utr_active ON payments (utr_number) 
    WHERE status IN ('VERIFIED', 'PROOF_SUBMITTED');
    ```
  - Generate dynamic UPI payment links/QRs pre-encoding the exact invoice shortcode into the UPI Transaction Note (`tn=RentPilot-<invoice_id>`).
  - Strict payment verification state machine: `PENDING_UPLOAD` -> `PROOF_SUBMITTED` -> `UNDER_REVIEW` -> `VERIFIED` | `REJECTED` | `PARTIAL_PAYMENT`.

#### D. Asset Storage: Supabase Storage with Private Buckets (Resolved)
* **Agreed Decision**: **Supabase Storage** is selected as the primary asset storage platform (replacing Cloudinary).
  - Private buckets for `payment_proofs`, `tenancy_agreements`, and `maintenance_photos`.
  - Access is governed directly by PostgreSQL RLS policies matching the database tables.
  - Ephemeral signed URLs (`createSignedUrl`) with a 15-minute validity window are generated on-demand only for authorized landlords or the specific tenant associated with that record.

#### E. Billing Idempotency & Concurrency (Resolved)
* **Resolution**:
  - Enforce database constraint: `UNIQUE (unit_id, billing_period_month, billing_period_year)` on `invoices`.
  - Immutable state transitions: once an invoice transitions from `DRAFT` to `ISSUED`, associated variable charge line items are locked.

#### F. Hosting & Commercial Licensing (Resolved)
* **Agreed Decision**: **Vercel** is retained as the hosting and deployment platform.
  - Development and eligible preview deployments will run on Vercel.
  - Prior to production launch, applicable Vercel commercial-use terms will be reviewed. If a paid plan (Vercel Pro at $20/mo) is required, the exact cost and timeline will be presented before activation. No migration to alternative providers will occur.

---

## Goals vs. Non-Goals

### In-Scope Goals
* **Dynamic Property & Unit Hierarchy**: Arbitrary count of properties, floors, and rental units (1BHK, 2BHK, custom layouts, facilities).
* **Tenancy & Lease Management**: Start rent, security deposits, scheduled percentage-based rent increments with configurable dates.
* **Monthly Billing & Variable Charges**: Manual entry of electricity, water, and maintenance charges; automatic generation of itemized monthly invoices on the configurable billing preparation date (default 10th).
* **UPI Payment Tracking**: QR code display, tenant proof upload (UTR + screenshot), landlord verification queue, partial payment tracking, and receipt generation.
* **Tenant Self-Service Portal**: Mobile-responsive dashboard for viewing invoices, payment history, balance due, and submitting maintenance requests with photos.
* **Maintenance Workflow**: Tenant ticket submission with photos, landlord status updates, and expense tracking.
* **Multi-Language Support**: Trilingual UI localization (English, Kannada, Hindi) via `next-intl`.
* **Idempotent Accounting**: Ledger architecture preventing duplicate billing, duplicate UTR submissions, and retroactive invoice mutations.
* **Multi-Tenancy Foundation**: `organization_id` foreign key on all core domain tables with PostgreSQL RLS isolation.

### Out-of-Scope Non-Goals
* **Electricity Meter Calculations**: No automated meter reading delta calculations or tiered tariff computation (charges are entered as pre-calculated currency amounts).
* **Automated Bank Gateway / Auto-Debit**: No paid payment gateway integrations (Razorpay, Cashfree, Stripe); zero transaction processing fees.
* **Direct WhatsApp Cloud API**: Defer paid Meta WhatsApp Business API integration; use zero-cost mail (Brevo free tier) and direct `wa.me` deep links for landlord-initiated messaging.
* **Multi-Landlord SaaS Self-Signup**: No public sign-up funnel, billing tiers, or Stripe subscriptions for new landlords in the MVP.
* **Native Mobile Apps**: Mobile-responsive web application only.

---

## Alternatives Weighed

1. **Hosting Platform**: Vercel vs. Cloudflare Pages / Netlify.
   * *Outcome*: Vercel retained throughout development and preview. Commercial terms to be confirmed before production.

2. **Asset Storage**: Cloudinary vs. Supabase Storage.
   * *Outcome*: Supabase Storage selected for unified PostgreSQL RLS, native signed URLs, and elimination of external third-party storage credentials.

3. **Authentication**: Official Supabase Third-Party Firebase Auth vs. Custom JWT Signing.
   * *Outcome*: Official Supabase third-party integration selected. Custom JWT minting is rejected as redundant and risky.

4. **Scheduled Invoicing**: Push Cron vs. Demand-Driven Evaluation.
   * *Outcome*: Supabase `pg_cron` with Edge Functions retained, supplemented by an external GitHub Actions 48-hour heartbeat and lazy on-demand evaluation upon landlord login.

---

## Key Decisions & Staging for Next Steps

1. **Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, next-intl, Firebase Auth (Google Sign-In), Supabase PostgreSQL + Supabase Storage, Brevo.
2. **Hosting**: Vercel.
3. **Database Schema & RLS**:
   - Tables: `organizations`, `organization_memberships`, `profiles`, `properties`, `units`, `tenancies`, `rent_schedules`, `billing_cycles`, `invoices`, `invoice_items`, `payments`, `maintenance_requests`, `audit_logs`.
   - Security: Every table enforces RLS checking `(auth.jwt() ->> 'sub')`.
4. **Billing Engine**:
   - Preparation date configurable (default 10th). Variable charges entered via landlord UI. Invoices finalized on demand or on approval.
5. **Payment Verification**:
   - Mandatory 12-digit UTR entry + screenshot. Unique active UTR constraint prevents duplicate claims.
