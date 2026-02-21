# Payment Infrastructure Plan

## A: Current State Assessment

Vizora has a **substantially built** payment infrastructure with dual-provider support (Stripe + Razorpay). The core backend, database models, and frontend pages are in place. However, several critical operational gaps exist that would prevent production billing from working correctly.

| Component | Status | Notes |
|---|---|---|
| **Stripe SDK installed** | EXISTS | `stripe` package in middleware dependencies |
| **Stripe API keys configured** | EXISTS (template) | `.env.production.example` has placeholders; needs real keys |
| **Razorpay SDK installed** | EXISTS | `razorpay` package in middleware dependencies |
| **Stripe webhook endpoint** | EXISTS | `POST /webhooks/stripe` with signature verification |
| **Razorpay webhook endpoint** | EXISTS | `POST /webhooks/razorpay` with HMAC-SHA256 |
| **Customer creation on signup** | EXISTS (lazy) | Customer created on first checkout, not registration |
| **Circuit breaker on providers** | EXISTS | Failure threshold: 3, reset: 10s on both providers |
| **Subscriptions table** | EXISTS | Via `Organization` model fields + `BillingTransaction` |
| **Plans/pricing table** | EXISTS | `Plan` model in Prisma + `PLAN_TIERS` constants |
| **Invoices/payments table** | EXISTS | `BillingTransaction` model |
| **Promotions/discounts system** | EXISTS | `Promotion`, `PlanPromotion`, `PromotionRedemption` models |
| **Trial tracking fields** | EXISTS | `trialEndsAt`, `subscriptionStatus` on Organization |
| **Checkout endpoint** | EXISTS | `POST /billing/checkout` creates Stripe/Razorpay session |
| **Subscription management endpoints** | EXISTS | upgrade, downgrade, cancel, reactivate, portal |
| **Billing portal (Stripe)** | EXISTS | `GET /billing/portal` returns Stripe portal URL |
| **Invoice history endpoint** | EXISTS | `GET /billing/invoices` fetches from provider |
| **Quota guard** | EXISTS | `@CheckQuota('screen')` on display creation |
| **Subscription active guard** | EXISTS | Guard code written but **NOT applied to any routes** |
| **Upgrade UI / Plans page** | EXISTS | Plans comparison with monthly/yearly toggle, checkout |
| **Billing settings page** | EXISTS | Current plan, quota, manage billing, cancel, reactivate |
| **Invoice history page** | EXISTS | Table with dates, amounts, status, PDF download |
| **Frontend API client** | EXISTS | All 9 billing methods implemented in apiClient |
| **Plan card component** | EXISTS | Reusable plan display card |
| **Status badge component** | EXISTS | Subscription status indicator |
| **Quota bar component** | EXISTS | Screen usage visualization |
| **Admin plan management** | EXISTS | Full CRUD for plans + promotions |
| **Admin trial extension** | EXISTS | `extendTrial(orgId, days)` in admin service |
| **E2E tests for billing** | EXISTS | `16-billing.spec.ts` + unit tests for all billing code |
| | | |
| **Trial badge in dashboard header** | MISSING | No countdown banner visible across all pages |
| **Upgrade CTA banner** | MISSING | No persistent upgrade prompt in dashboard |
| **Trial expiry guard on write ops** | MISSING | Guard exists but not applied to routes |
| **Trial auto-downgrade cron** | MISSING | No job to expire trials when `trialEndsAt` passes |
| **Trial reminder emails** | MISSING | No emails at 10/5/2 days before expiry |
| **Trial expired email** | MISSING | No notification when trial ends |
| **Welcome email on registration** | MISSING | No post-registration email |
| **Payment receipt email** | MISSING | No receipt after successful payment |
| **Payment failure email** | MISSING | No notification on failed payment |
| **Cancellation confirmation email** | MISSING | No email when subscription canceled |
| **Plan change confirmation email** | MISSING | No email when plan upgraded/downgraded |
| **Grace period logic** | MISSING | No 7-day grace on failed payment before downgrade |
| **Read-only mode for expired orgs** | MISSING | Expired orgs not blocked from write operations |
| **Trial duration consistency** | BUG | Auth sets 7-day trial; UI text says "30-day trial" |
| **Storage quota enforcement** | MISSING | `storageQuotaBytes` tracked but not enforced on upload |

---

## B: What Needs to Be Built (Priority Order)

### Priority 1: Trial Foundation Fixes (CRITICAL)
The trial system has the database fields but lacks enforcement. Without these, users on expired trials can still use everything.

1. **Fix trial duration**: Change auth.service from 7 days to 30 days
2. **Apply SubscriptionActiveGuard** to all write endpoints (content, playlists, schedules, displays)
3. **Build trial auto-downgrade cron job**: Daily check for expired trials
4. **Add trial countdown banner** to dashboard layout (visible on all pages)
5. **Implement read-only mode**: Block write operations, show upgrade CTAs instead of errors

### Priority 2: Email Infrastructure (HIGH)
The mail service exists (nodemailer with SMTP) but only sends password reset emails.

6. **Welcome email** after registration
7. **Trial reminder emails** (10 days, 5 days, 2 days before expiry)
8. **Trial expired email** on expiry day
9. **Payment receipt email** on successful payment (webhook handler)
10. **Payment failure email** on failed payment (webhook handler)
11. **Cancellation confirmation email** on subscription cancel
12. **Trial reminder cron job**: Daily check + send appropriate emails

### Priority 3: Payment Flow Hardening (MEDIUM)
The checkout flow works but lacks edge case handling.

13. **Grace period logic**: 7 days after payment failure before downgrade
14. **Storage quota enforcement**: Check on content upload
15. **Success/cancel pages**: Dedicated post-checkout pages with clear messaging

### Priority 4: Polish & UX (LOWER)
16. **Upgrade CTA banner** when approaching limits
17. **Loading states** on all payment actions (some exist, verify completeness)
18. **Mobile responsiveness** audit on billing pages

---

## C: Database Schema Changes

### No new tables needed.

The existing schema already has everything required:
- `Organization` — trial fields, subscription fields, payment provider IDs
- `BillingTransaction` — payment history
- `Plan` — plan definitions with pricing
- `Promotion` / `PlanPromotion` / `PromotionRedemption` — discount system

### Fixes needed:

1. **Trial duration in auth.service.ts** (line ~65):
   - Change: `trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)`
   - To: `trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)`

2. **Storage quota default** (schema.prisma line 34):
   - Current: `storageQuotaBytes BigInt @default(5368709120)` (5GB)
   - Required: `storageQuotaBytes BigInt @default(1073741824)` (1GB for trial)
   - Note: This changes the default for new orgs. Existing orgs keep their current value.
   - Need migration to update existing trial orgs.

3. **Seed data for Plan table**: Ensure plan records exist in DB matching `PLAN_TIERS` constants. Currently plans are defined only as TypeScript constants — they should also be seeded into the `Plan` table.

---

## D: API Endpoints Needed

### Existing endpoints (no changes needed):
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/billing/subscription` | Get subscription status |
| `GET` | `/api/v1/billing/plans` | List available plans |
| `GET` | `/api/v1/billing/quota` | Get quota usage |
| `POST` | `/api/v1/billing/checkout` | Create checkout session |
| `POST` | `/api/v1/billing/upgrade` | Change plan (upgrade) |
| `POST` | `/api/v1/billing/downgrade` | Change plan (downgrade) |
| `POST` | `/api/v1/billing/cancel` | Cancel subscription |
| `POST` | `/api/v1/billing/reactivate` | Reactivate canceled subscription |
| `GET` | `/api/v1/billing/portal` | Get Stripe billing portal URL |
| `GET` | `/api/v1/billing/invoices` | Get invoice history |
| `POST` | `/api/v1/webhooks/stripe` | Stripe webhook handler |
| `POST` | `/api/v1/webhooks/razorpay` | Razorpay webhook handler |

### No new endpoints needed.
All required billing API routes already exist. The work is in guard application, email sending, and cron jobs — all backend-only changes.

---

## E: Stripe Configuration

### Products & Prices to create in Stripe Dashboard:
| Product | Monthly Price ID | Yearly Price ID |
|---|---|---|
| Vizora Basic (per screen) | `price_basic_monthly` | `price_basic_yearly` |
| Vizora Pro (per screen) | `price_pro_monthly` | `price_pro_yearly` |

- Prices are **per-unit** (per screen), billed monthly or yearly
- Basic: $6/screen/month, $60/screen/year (~17% discount)
- Pro: $8/screen/month, $80/screen/year (~17% discount)
- Enterprise: Manual/custom — no Stripe price needed

### Webhook events to subscribe to:
- `checkout.session.completed` — activate subscription after payment
- `customer.subscription.updated` — sync plan changes
- `customer.subscription.deleted` — handle cancellation
- `invoice.payment_succeeded` — update status, record transaction
- `invoice.payment_failed` — mark past_due, start grace period

### Environment variables needed:
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASIC_MONTHLY_PRICE_ID=price_...
STRIPE_BASIC_YEARLY_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
```

### Test mode plan:
- All development uses `sk_test_` keys
- Test cards: `4242424242424242` (success), `4000000000000002` (decline)
- Stripe CLI for local webhook testing: `stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe`

---

## F: Frontend Pages/Components Needed

### New components to build:
| Component | Location | Purpose |
|---|---|---|
| `TrialBanner` | `web/src/components/TrialBanner.tsx` | Countdown badge in dashboard header ("Free Trial — 14 days left") |
| `UpgradeBanner` | `web/src/components/UpgradeBanner.tsx` | CTA when approaching limits or trial expiring |
| `ExpiredOverlay` | `web/src/components/ExpiredOverlay.tsx` | Read-only overlay when trial/subscription expired |

### Existing pages (modifications needed):
| Page | Change |
|---|---|
| Dashboard layout (`layout.tsx`) | Add `TrialBanner` to header area |
| Plans page | Fix "30-day trial" text consistency |
| Billing settings page | Minor: show storage usage alongside screen usage |

### New pages:
| Page | Path | Purpose |
|---|---|---|
| Checkout success | `/dashboard/settings/billing/success` | Post-payment confirmation |
| Checkout cancel | `/dashboard/settings/billing/cancel` | Payment not completed, try again |

---

## G: Email Templates Needed

All emails use the existing `MailService` (nodemailer). New methods to add:

| Email | Trigger | Subject Line |
|---|---|---|
| Welcome | Registration | "Welcome to Vizora — Your 30-day trial has started" |
| Trial reminder (10 days) | Cron (day 20) | "Your Vizora trial ends in 10 days" |
| Trial reminder (5 days) | Cron (day 25) | "5 days left on your Vizora trial" |
| Trial reminder (2 days) | Cron (day 28) | "Your Vizora trial expires in 2 days" |
| Trial expired | Cron (day 30) | "Your Vizora trial has ended" |
| Payment receipt | Webhook: invoice.paid | "Payment received — Vizora [Plan] subscription" |
| Payment failed | Webhook: invoice.payment_failed | "We couldn't process your payment" |
| Plan changed | API: upgrade/downgrade | "Your Vizora plan has been updated" |
| Subscription canceled | API: cancel | "Your Vizora subscription has been canceled" |

---

## H: Implementation Batches

### Batch 1: Trial Foundation (CRITICAL — do first)
**Files to modify:**
- `middleware/src/modules/auth/auth.service.ts` — Fix trial to 30 days
- `packages/database/prisma/schema.prisma` — Change default storage to 1GB
- `middleware/src/modules/billing/guards/subscription-active.guard.ts` — Verify logic
- `middleware/src/modules/content/content.controller.ts` — Apply `@RequiresSubscription()`
- `middleware/src/modules/playlists/playlists.controller.ts` — Apply `@RequiresSubscription()`
- `middleware/src/modules/schedules/schedules.controller.ts` — Apply `@RequiresSubscription()`
- `middleware/src/modules/displays/displays.controller.ts` — Apply to create/update (QuotaGuard already on create)
- `web/src/components/TrialBanner.tsx` — New component
- `web/src/app/dashboard/layout.tsx` — Add TrialBanner

**Deliverables:**
- Trial correctly set to 30 days with 1GB storage / 5 screens
- Write operations blocked when trial expired or subscription inactive
- Trial countdown badge visible in dashboard header
- Clear upgrade CTA when blocked

### Batch 2: Trial Lifecycle Cron Jobs
**Files to modify/create:**
- `middleware/src/modules/billing/billing-lifecycle.service.ts` — New service with cron jobs
- `middleware/src/modules/billing/billing.module.ts` — Register lifecycle service
- `middleware/src/modules/mail/mail.service.ts` — Add billing email methods

**Deliverables:**
- Daily cron: auto-expire trials past `trialEndsAt`
- Daily cron: send reminder emails at 10/5/2 days before expiry
- Daily cron: send expired email on expiry day
- Welcome email on registration

### Batch 3: Payment Flow Polish
**Files to modify/create:**
- `middleware/src/modules/billing/billing.service.ts` — Add grace period logic
- `middleware/src/modules/mail/mail.service.ts` — Add payment receipt, failure, cancel emails
- `web/src/app/dashboard/settings/billing/success/page.tsx` — New page
- `web/src/app/dashboard/settings/billing/cancel/page.tsx` — New page

**Deliverables:**
- Post-checkout success/cancel pages
- Payment receipt email on successful payment
- Payment failure email with "update card" CTA
- 7-day grace period before downgrade on payment failure
- Cancellation confirmation email

### Batch 4: Storage Quota & Upgrade CTAs
**Files to modify:**
- `middleware/src/modules/content/content.service.ts` — Enforce storage quota on upload
- `web/src/components/UpgradeBanner.tsx` — New component
- `web/src/app/dashboard/layout.tsx` — Add UpgradeBanner logic

**Deliverables:**
- Storage quota enforced on file upload (reject with upgrade CTA if over limit)
- Upgrade banner when approaching screen/storage limits
- Contextual upgrade prompts (not generic errors)

### Batch 5: Email Templates & Integration Testing
**Files to modify:**
- `middleware/src/modules/mail/mail.service.ts` — Finalize all email templates
- All email methods tested with SMTP or console logging

**Deliverables:**
- All 9 email templates implemented with branded HTML
- End-to-end test: register → trial → expiry → upgrade → active
- Verify webhook handling for all events
- Verify cron jobs fire correctly

---

## I: Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stripe keys not configured | HIGH (dev) | Graceful fallback: billing features hidden if no keys |
| Webhook signature fails | MEDIUM | Stripe CLI for local testing; logging on failure |
| Trial duration rollout | LOW | Only affects new registrations; existing orgs unaffected |
| Guard blocks legitimate users | MEDIUM | Thorough testing; fallback: admin trial extension |
| Email delivery fails | LOW | Console fallback in dev; production SMTP required |
| Proration edge cases | MEDIUM | Rely on Stripe's built-in proration; test with Stripe CLI |

---

## J: Production Go-Live Checklist (Post-Implementation)

- [ ] Create Stripe account and verify business
- [ ] Create Products and Prices in Stripe Dashboard
- [ ] Set environment variables with real Stripe keys
- [ ] Configure Stripe webhook endpoint with production URL
- [ ] Test full flow with Stripe test mode
- [ ] Enable Stripe live mode
- [ ] Configure SMTP for production email delivery
- [ ] Backfill existing organizations: set `trialEndsAt` for orgs without subscriptions
- [ ] Seed Plan table with pricing data
- [ ] Monitor webhook delivery in Stripe Dashboard
- [ ] Set up Stripe billing alerts and dispute notifications
