# RentPilot — Operations, Reliability & Backup Runbook

This runbook establishes standard operating procedures, deployment workflows, scheduled job mechanics, backup/restore protocols, and explicit provider free-tier operational boundaries for the **RentPilot Property Operations** system.

---

## 1. Initial Production Setup & Infrastructure Provisioning

### 1.1 PostgreSQL Database Migrations (Supabase)
RentPilot relies on strict relational constraints, GiST exclusion constraints (`btree_gist`), and PostgreSQL Row Level Security (RLS). Execute the migrations in `supabase/migrations/` sequentially in the Supabase SQL Editor:

1. `20261116000000_stage_b_auth_and_organizations.sql` — Profiles, organizations, memberships, invitations, and Firebase JWT helper functions.
2. `20261117000000_stage_c_core_rental_domain.sql` — Properties, units, tenants, tenancies with non-overlapping `tsrange` exclusion constraints, and rent increment schedules.
3. `20261118000000_stage_d_billing_and_financials.sql` — Billing cycles, invoices, payments, payment submissions with normalized UTR uniqueness, and financial audit logs.
4. `20261119000000_stage_e_maintenance_and_notifications.sql` — Maintenance requests, photos, repair expense tracking (`BIGINT` paise), and in-app notifications.
5. `20261120000000_stage_f_scheduling_and_reliability.sql` — Idempotency keys, job execution logs, and message delivery retry logs.

### 1.2 Firebase Authentication to Supabase Bridge
1. In the **Firebase Console**, enable **Google Sign-In** under **Authentication > Sign-in method**.
2. Generate a Service Account private key JSON under **Project Settings > Service accounts > Generate new private key**. Populate `FIREBASE_ADMIN_*` environment variables.
3. In the **Supabase Dashboard**, navigate to **Authentication > Providers > Third-Party Auth**, enable Firebase, and configure your Firebase Project ID. This enables Supabase PostgreSQL RLS policies to decode Firebase ID tokens via `(auth.jwt() ->> 'sub')`.

### 1.3 Private Storage Buckets
RentPilot enforces private bucket access for all sensitive financial and maintenance assets. Under **Supabase Dashboard > Storage**:
1. Create private bucket: `receipts` (Public access: **Disabled**).
2. Create private bucket: `maintenance-photos` (Public access: **Disabled**).
3. Access is granted exclusively through short-lived (15-minute) signed download URLs generated server-side after verifying organization membership.

### 1.4 Environment Variables Configuration (Vercel)
Configure the following production environment variables in your Vercel Project Settings:

| Variable | Description | Exposure |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key | Browser (Public) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | Browser (Public) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID | Browser (Public) |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin Project ID | Server Only |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin Service Account Email | Server Only |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin Private Key PEM | Server Only |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project API URL | Browser (Public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | Browser (Public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Server Only |
| `BREVO_API_KEY` | Brevo Transactional Email Key | Server Only |
| `BREVO_SENDER_EMAIL` | Verified sender address (e.g. `notifications@yourdomain.com`) | Server Only |
| `BREVO_SENDER_NAME` | Sender display name (e.g. `RentPilot Billing`) | Server Only |
| `CRON_SECRET` | High-entropy random secret securing cron webhook | Server Only |
| `NEXT_PUBLIC_APP_URL` | Production application URL (e.g. `https://rentpilot.vercel.app`) | Browser (Public) |
| `APP_BASE_URL` | Server-side base URL | Server Only |

---

## 2. Scheduling, Reliability & Job Execution Architecture

### 2.1 The Daily Maintenance & Billing Job
The scheduled job engine (`src/lib/jobs/scheduler.ts`) performs four critical operations in an idempotent transaction:
- **Task A (Billing Cycle Preparation):** Checks property `billing_day_of_month` and ensures monthly billing cycles and draft invoices exist.
- **Task B (Overdue Invoice Reconciliation):** Scans all invoices where `due_date < CURRENT_DATE` and `balance_due_paise > 0`.
  - *Invariant:* If status is `ISSUED`, it transitions to `OVERDUE`.
  - *Invariant:* If status is `PARTIALLY_PAID`, the status remains `PARTIALLY_PAID` and `is_overdue = true` is set.
- **Task C (Rent Increment Lead-Time Alerts):** Identifies active rent increments due within the next 30 days. Emits an in-app alert to the owner and records idempotency key `rent_increment_due:{schedule_id}:{next_increment_date}` so owners are not spammed daily.
- **Task D (Transactional Email Retries):** Retries failed Brevo deliveries logged in `message_delivery_logs` (bounded at 3 retries with exponential backoff).

### 2.2 Trigger Methods
1. **Cloud Cron Webhook (`POST /api/cron/run`):**
   - Protected by timing-safe `Authorization: Bearer <CRON_SECRET>` validation.
   - Called daily at 02:30 UTC (08:00 IST) via Supabase `pg_cron` or external scheduler.
2. **Demand-Driven Dashboard Recovery (`POST /api/billing/reconcile`):**
   - Automatically executed in the background whenever an owner navigates to `/dashboard/owner`.
   - Guarantees overdue status and increment notices are reconciled in real-time even if external cron was missed.
3. **Supabase `pg_cron` Extension (Optional Built-In Scheduler):**
   Enable `pg_cron` and `pg_net` in Supabase Cloud to run natively:
   ```sql
   SELECT cron.schedule(
     'rentpilot-daily-scheduled-jobs',
     '30 2 * * *',
     $$
     SELECT net.http_post(
       url := 'https://your-rentpilot-domain.vercel.app/api/cron/run',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
       ),
       body := jsonb_build_object('source', 'PG_CRON')
     ) AS request_id;
     $$
   );
   ```

---

## 3. Automated 48-Hour Heartbeat Keepalive (GitHub Actions)

### 3.1 The Supabase Free-Tier Pause Risk
Supabase automatically pauses free-tier projects if no database queries are received for **7 consecutive days**. Once paused, REST API and database requests fail until manually resumed in the Supabase Cloud console.

### 3.2 The Keepalive Safeguard
RentPilot includes a native GitHub Actions workflow (`.github/workflows/heartbeat.yml`) that triggers every 48 hours (`0 0 */2 * *`).
- The workflow pings `GET /api/health`.
- `/api/health` performs a lightweight, read-only PostgreSQL query (`SELECT id FROM organizations LIMIT 1`).
- This resets the 7-day inactivity timer on Supabase automatically without manual intervention.

**Configuration:**
Add repository secret `RENTPILOT_APP_URL` in **GitHub > Repository Settings > Secrets and variables > Actions > New repository secret** set to `https://your-app-domain.vercel.app`.

---

## 4. Backup, Export & Disaster Recovery Runbook

### 4.1 Running Database Backup
The backup utility (`scripts/backup-export.ts`) exports all tenant, tenancy, financial, maintenance, and audit records into an immutable JSON document with an accompanying SHA-256 cryptographic checksum.

```bash
# Run backup export
npm run backup:export
```
Output files are stored in `backups/`:
- `rentpilot_backup_YYYY-MM-DDTHH-MM-SS.json`
- `rentpilot_backup_YYYY-MM-DDTHH-MM-SS.json.sha256`

### 4.2 Verifying Backup Integrity
To verify the checksum and schema structure of the latest backup without modifying data:
```bash
npx tsx scripts/backup-export.ts --verify-only
```
Or verify a specific file:
```bash
npx tsx scripts/backup-export.ts --verify-only backups/rentpilot_backup_2026-11-20T08-00-00.json
```

### 4.3 Database Restoration Sequence
In disaster recovery scenarios, data must be restored according to foreign key constraints:
1. `organizations`
2. `profiles`
3. `organization_memberships`
4. `properties`
5. `units`
6. `tenants`
7. `tenancies`
8. `rent_increment_schedules`
9. `billing_cycles`
10. `invoices`
11. `payment_submissions`
12. `payments`
13. `maintenance_requests`
14. `maintenance_photos`
15. `notifications`
16. `audit_logs`

---

## 5. Provider Free-Tier Operational Boundaries & Disclosures

| Provider | Service | Free Tier Boundary | Operational Safeguard in RentPilot | Upgrade Threshold |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Web Hosting & Serverless Functions | Hobby tier covers personal/non-commercial projects; 100GB bandwidth, 1,000 Edge executions. | RentPilot relies strictly on standard App Router endpoints and SSR. No heavy long-running processes. | Verify commercial-use terms. If commercial rental operation requires paid plan, upgrade to Vercel Pro ($20/month per member). |
| **Supabase** | PostgreSQL Database & Storage | 500MB DB storage, 1GB file storage, 2 active projects. Pauses after 7 days inactivity. | GitHub Actions heartbeat (`.github/workflows/heartbeat.yml`) queries DB every 48 hours. Storage uses compressed receipts and photos. | Upgrade to Supabase Pro ($25/month) when portfolio exceeds 1GB storage or requires zero pause risk SLA. |
| **Firebase** | Identity & Auth | 50,000 monthly active users (MAU) for Google Sign-In. | Authentication utilizes standard Firebase Client SDK without costly phone SMS verification. | 50,000 MAU free tier is sufficient for small-to-medium landlord operations. |
| **Brevo** | Transactional Email | 300 emails/day free limit. | Transactional emails are restricted to vital events (Invoices, Receipts, Urgent Maintenance). Failed deliveries logged in `message_delivery_logs`. | Upgrade to Brevo Starter ($15/month for 20,000 emails/month) if daily volume approaches 250 emails/day. |
