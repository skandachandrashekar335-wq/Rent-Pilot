# RentPilot

**A cloud-based rental and property management platform for landlords and tenants.**

RentPilot is being developed to simplify the day-to-day operations of residential rentals: managing properties and units, maintaining tenancy records, preparing monthly invoices, tracking UPI payments, and handling maintenance requests in one place.

> **Project status:** In active development. This repository contains the evolving application and its approved product/architecture specification. Features described below represent the product scope; they should not all be assumed to be production-ready.

---

## Product goals

- Give landlords a single place to manage properties, rental units, tenants, leases, charges, invoices, and maintenance.
- Give tenants a simple, mobile-friendly place to view bills, track payment status, submit payment proof, and raise maintenance requests.
- Make billing and payment records reliable through database constraints, explicit review states, and tenant-level data isolation.
- Support English, Kannada, and Hindi.
- Keep the initial deployment practical for a small residential rental operation while leaving a clean foundation for future multi-organization support.

## Planned capabilities

| Area | Scope |
| --- | --- |
| Property management | Configurable properties, floors, units, layouts, and occupancy |
| Tenancy management | Tenant assignments, lease dates, deposits, rent schedules, and scheduled percentage-based rent increases |
| Monthly billing | Itemized invoices with manually entered electricity, water, and maintenance charges |
| Payments | UPI payment details, tenant-submitted UTR and proof, landlord verification, partial payments, and receipts |
| Maintenance | Tenant requests with photo attachments, landlord updates, and expense tracking |
| Notifications | Email communication for billing and relevant account events |
| Localization | English, Kannada, and Hindi |
| Access control | Organization-aware data model and PostgreSQL Row Level Security (RLS) |

## Technology

| Layer | Technology |
| --- | --- |
| Application | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Authentication | Firebase Authentication (Google sign-in) |
| Database | Supabase PostgreSQL |
| Authorization | PostgreSQL Row Level Security (RLS) |
| File storage | Supabase Storage with private buckets and short-lived signed URLs |
| Localization | next-intl |
| Email | Brevo |
| Hosting target | Vercel |

The application uses Firebase Authentication with Supabase's native third-party Firebase integration. Firebase ID tokens are passed to Supabase; authorization is enforced through database RLS policies. The design avoids custom JWT signing with the Supabase secret.

## Reliability and security principles

- **Tenant isolation:** Core records are scoped to an organization and protected by RLS.
- **Payment review:** Payment submission and landlord verification are separate states; a tenant cannot mark a payment as verified.
- **Duplicate-payment protection:** Active UTR references are subject to a database uniqueness constraint.
- **Billing idempotency:** A unit can have only one invoice for a given billing period.
- **Invoice integrity:** Issued invoices and their line items are protected against unintended retroactive changes.
- **Private files:** Payment proofs, agreements, and maintenance photos are stored in private buckets and exposed through authorized, short-lived signed URLs.
- **Operational resilience:** Billing evaluation is designed not to depend exclusively on a background scheduled job.

## Out of scope for the initial release

- Automated electricity-meter readings or tariff calculations; monthly utility amounts are entered by the landlord.
- Paid payment-gateway processing or automatic bank debits.
- Direct WhatsApp Business API integration.
- Public landlord self-service SaaS signup and subscription billing.
- Native iOS or Android applications.

## Local development

### Prerequisites

- Node.js compatible with the installed Next.js version
- npm (or another compatible package manager)
- Firebase and Supabase projects configured for the application

### Setup

```bash
git clone https://github.com/skandachandrashekar335-wq/Rent-Pilot.git
cd Rent-Pilot
npm install
```

Create a local environment file using the variables documented by the application. Do not commit credentials, service-role keys, private keys, or production environment files.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Available scripts

```bash
npm run dev           # Start the development server
npm run build         # Create a production build
npm run start         # Start the production server
npm run lint          # Run ESLint
npm run backup:export # Export a database backup (requires configured environment)
```

## Project documentation

- [Product and architecture brief](./concepts_brief.md) — approved scope, architecture decisions, security model, and implementation constraints.

## Development principles

- Preserve existing working behavior and security boundaries.
- Prefer small, verifiable changes over unnecessary rewrites.
- Treat database constraints and RLS policies as part of the product, not optional hardening.
- Document implementation status accurately; planned capabilities are not represented as completed features.
- Review hosting and third-party service terms before production use.

---

**RentPilot** — clearer rental operations, more reliable records.
