# RentPilot — Design Research & Design System Specification

* **Date:** 2026-11-12
* **Project:** RentPilot (Rental & Property Management Web Application)
* **Status:** Complete (Phase 2 Design Knowledge & Architecture Revalidation)

---

## 1. Authentication Bridge Revalidation

### Supabase Official Third-Party Firebase Auth Architecture

Following your requirement, we conducted an empirical audit of the Supabase third-party authentication architecture (`supabase.com/docs/guides/auth/third-party/firebase-auth`).

#### Verdict on Custom JWT Minting
* **Custom JWT signing with the Supabase secret is rejected.**
* It introduces unnecessary cryptographic risk, secret exposure vectors on the server, and dual-maintenance overhead.
* Supabase natively supports Firebase Authentication as an external identity provider using asymmetric RS256 verification against Google’s public JWKS endpoints.

#### Implementation Blueprint
1. **Supabase Configuration**:
   ```toml
   # In supabase/config.toml (or Supabase Dashboard -> Authentication -> Third-Party Auth)
   [auth.third_party.firebase]
   enabled = true
   project_id = "<your-firebase-project-id>"
   ```
2. **Browser Client Integration**:
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   import { auth } from '@/lib/firebase/client';

   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
     {
       accessToken: async () => {
         return (await auth.currentUser?.getIdToken(/* forceRefresh */ false)) ?? null;
       },
     }
   );
   ```
3. **Next.js Server Component (RSC) Integration**:
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   import { cookies } from 'next/headers';

   export async function createServerSupabaseClient() {
     const cookieStore = await cookies();
     const token = cookieStore.get('firebase_id_token')?.value;

     return createClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
       {
         accessToken: async () => token ?? null,
         auth: { persistSession: false },
       }
     );
   }
   ```
4. **PostgreSQL RLS Integration**:
   Firebase user tokens carry the standard `role: 'authenticated'` custom claim. PostgreSQL RLS policies evaluate the user's identity directly via:
   ```sql
   (auth.jwt() ->> 'sub')
   ```
   This is compared against the `firebase_uid` (`varchar` / `text`) column in `profiles` and `organization_memberships`.

---

## 2. GitHub Design Repositories & Knowledge Synthesis

We audited the core design skill repositories and reference design systems using Ego Browser:

### A. Core Repositories Studied

| Repository | Stars / Status | Key Rules & Concrete Principles |
| :--- | :--- | :--- |
| **`pbakaus/impeccable`** | Active (4 days ago), MIT | **AI-Slop Detector (62 rules)**:<br>• Never use unearned floating background gradient blobs.<br>• Never put tracked-out uppercase eyebrow labels (`text-xs tracking-widest uppercase`) above every heading.<br>• Never highlight a single word in a headline with accent color.<br>• Every interactive element must define 5 states: default, hover, focus-visible, active, disabled.<br>• Contrast must meet WCAG AA (≥ 4.5:1 text, ≥ 3:1 graphical elements). |
| **`Leonxlnx/taste-skill`** | Active (5 days ago), MIT | **"One system, equal edges, one section per screen"**:<br>• 8px baseline spatial rhythm (4, 8, 12, 16, 24, 32, 48, 64).<br>• Equal edge margins across all viewports (`px-4 sm:px-6 lg:px-8`).<br>• High-density financial data presentation: tabular numerals (`tabular-nums`), clean vertical baselines, no decorative borders where whitespace suffices. |
| **`nextlevelbuilder/ui-ux-pro-max-skill`** | Active (5 days ago), Apache-2.0 | **Financial / Real-Estate SaaS Profile**:<br>• Slate/Zinc neutral hierarchy with emerald accents for settled/verified financial states.<br>• Font pairing: Clean geometric grotesque for UI (Geist / Inter) + high-legibility monospace for currency and transaction references (Geist Mono).<br>• Border radius discipline: 6px–8px (`rounded-md` to `rounded-lg`) for professional restraint. |
| **`emilkowalski/skill`** | Active (4 days ago), MIT | **Animation Craft & Restraint**:<br>• Micro-interactions: 150ms–200ms duration, `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out quint).<br>• Dialogs/Drawers: 250ms–300ms enters/exits.<br>• Never animate layout triggers (`width`, `height`, `top`, `margin`); animate strictly GPU-accelerated `transform` and `opacity`.<br>• Hard accessibility requirement: zero animation when `prefers-reduced-motion: reduce`. |
| **`Nutlope/hallmark`** | Active (7 days ago), Apache-2.0 | **Anti-AI Gatekeeper**:<br>• Floor Gate: Broken mobile viewport (390px), focus-ring loss, low-contrast text are fatal ship blockers.<br>• Task-Centric Architecture: UI is constructed around the user's immediate job (landlord verifying payment; tenant paying UPI bill), avoiding decorative filler sections. |
| **`Motionsites-AI/claude-skill`** | Active (2 weeks ago), MIT | **Visual Polish & Look-and-Fix Loop**:<br>• Screenshot-based inspection at desktop (1280px) and mobile (390px).<br>• Verification of image aspect ratios, clipping bounds, and visual density. |

### B. Reference Repositories & 21st.dev Audit
* **`google-labs-code/design.md` & `VoltAgent/awesome-design-md`**: Validated plain-markdown token specifications for AI agents and human developers.
* **`alexpate/awesome-design-systems`**: Cross-referenced Atlassian, Stripe, and Primer design systems for table column alignments, badge color semantics, and form validation error states.
* **`21st.dev`**: Audited community components for financial dashboards, data tables, and status drawers. Selected patterns will be adapted strictly to our RentPilot design tokens rather than imported as unstyled dependencies.

---

## 3. RentPilot Design System Specification

### 3.1 Design Persona & Aesthetic Direction
* **Archetype**: Dependable Financial Infrastructure.
* **Tone**: Minimal, precise, calm, professional, approachable.
* **Inspirations**: Stripe Dashboard (clarity of financial ledgers), Linear (consistent interaction models and density), Vercel (monochrome restraint).

### 3.2 Color Tokens (WCAG AA Certified)

| Token Name | Light Mode (HEX / HSL) | Dark Mode (HEX / HSL) | Semantic Role |
| :--- | :--- | :--- | :--- |
| `background` | `#FFFFFF` (`0 0% 100%`) | `#09090B` (`240 10% 3.9%`) | Base canvas |
| `surface` | `#F8FAFC` (`210 40% 98%`) | `#121215` (`240 6% 7%`) | Card & sidebar containers |
| `surface-hover` | `#F1F5F9` (`210 40% 96%`) | `#18181B` (`240 5% 9.6%`) | Table row hover / button muted |
| `border` | `#E2E8F0` (`214 32% 91%`) | `#27272A` (`240 3.7% 15.9%`) | Component & divider borders |
| `text-primary` | `#0F172A` (`222 47% 11%`) | `#F8FAFC` (`210 40% 98%`) | Primary headings and values |
| `text-muted` | `#64748B` (`215 16% 47%`) | `#A1A1AA` (`240 5% 64.9%`) | Subtitles, labels, timestamps |
| `primary` | `#0F172A` (`222 47% 11%`) | `#F8FAFC` (`210 40% 98%`) | Core interactive actions |
| `status-verified` | `#059669` (`160 84% 39%`) | `#10B981` (`160 84% 39%`) | Paid status, verified UTR, receipts |
| `status-pending` | `#D97706` (`38 92% 50%`) | `#F59E0B` (`38 92% 50%`) | Pending verification, unbilled charges |
| `status-overdue` | `#DC2626` (`0 72% 51%`) | `#EF4444` (`0 84% 60%`) | Unpaid past due, rejected payment |

### 3.3 Typography Tokens

* **Primary Font**: `Geist Sans` / `Inter` (sans-serif)
* **Data & Financial Font**: `Geist Mono` / `JetBrains Mono` (monospace for INR amounts, dates, invoice numbers, and 12-digit UTR codes)

| Level | Size | Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | 28px (1.75rem) | 600 (Semibold) | 36px | -0.02em | Dashboard page titles |
| **Heading** | 20px (1.25rem) | 600 (Semibold) | 28px | -0.015em | Section & card titles |
| **Subheading**| 15px (0.9375rem) | 500 (Medium) | 22px | -0.01em | Table headers, form labels |
| **Body** | 14px (0.875rem) | 400 (Regular) | 20px | 0 | Descriptions, cell text |
| **Caption** | 12px (0.75rem) | 500 (Medium) | 16px | 0 | Status badges, timestamps |
| **Financial**| 14px–20px | 600 (Semibold) | 1 | 0 (tabular) | `tabular-nums font-mono` for currency |

### 3.4 Spacing & Elevation Rhythm
* **Baseline Grid**: 8px (with 4px half-steps).
* **Container Scales**:
  * Desktop Shell: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
  * Form / Modal Drawers: `max-w-xl mx-auto`
  * Mobile Viewport: 390px edge-to-edge padding `px-4`
* **Elevation**:
  * Flat surface with crisp borders (`border border-border`) for data tables and list items.
  * `shadow-sm` (`0 1px 2px 0 rgb(0 0 0 / 0.05)`) for interactive cards and dialogs.
  * Zero heavy blurry drop-shadows.

### 3.5 Component State Contract
Every interactive component (Buttons, Form Inputs, Table Rows, Tabs) implements 5 mandatory states:
1. **Default**: Clear contrast, visible boundaries.
2. **Hover**: Subtle background tint (`bg-muted/50`), pointer cursor.
3. **Focus-Visible**: Two-pixel crisp outline with offset (`ring-2 ring-primary ring-offset-2`).
4. **Active**: Subtle scale transform (`scale-[0.99]`).
5. **Disabled**: `opacity-50 cursor-not-allowed pointer-events-none`.

---

## 4. Tooling & Package Recommendations

### A. Skill Installation Status
All 7 core design skills are already cloned, symlinked, and operational in your environment:
- `impeccable` (`~/.gemini/config/skills/impeccable`)
- `taste-skill` (`~/.gemini/config/skills/taste-skill`)
- `ui-ux-pro-max` (`~/.gemini/config/skills/ui-ux-pro-max`)
- `animate` / `emil-animate` (`~/.gemini/config/skills/emil-animate`)
- `hallmark` (`~/.gemini/config/skills/hallmark`)
- `motionsites-web-builder` (`~/.gemini/config/skills/motionsites-web-builder`)
- `frontend-design` (`~/.gemini/config/skills/anthropic-frontend-design`)

### B. Proposed Runtime Packages for Application Build (Phase 5)

All proposed packages are **100% Free & Open Source (MIT / Apache-2.0)** with zero paid subscriptions:

| Package | Purpose | License | Why Selected |
| :--- | :--- | :--- | :--- |
| `next` (v15) | Core React Framework (App Router) | MIT | Retained for Vercel deployment |
| `react` & `react-dom` (v19) | UI Library | MIT | React Server Components & Actions |
| `typescript` | Static Typing | Apache-2.0 | Type safety across financial models |
| `tailwindcss` (v4 / v3.4) | Styling Engine | MIT | Utility-first tokens, minimal runtime |
| `@supabase/supabase-js` | Database & Storage Client | MIT | Official Supabase SDK with RLS |
| `firebase` & `firebase-admin` | Authentication Provider | Apache-2.0 | Google Sign-In & Server verification |
| `next-intl` | Localization (EN, KN, HI) | MIT | First-class App Router i18n support |
| `lucide-react` | Clean Iconography | ISC | Open-source icons, tree-shakeable |
| `zod` | Schema Validation | MIT | Validates UTRs, invoice amounts, forms |
| `clsx` & `tailwind-merge` | Class Composition | MIT | Standard utility for conditional styles |

---

*End of research/DESIGN_RESEARCH.md*
