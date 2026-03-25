# Vizora Billing & Subscription Lifecycle Test Report

**Date:** 2026-03-25
**Tester:** Claude (API tests + Playwright + code review)
**Environment:** https://vizora.cloud (production)

---

## Summary

| Section | Tests | Passed | Failed | Blocked | Bugs Fixed |
|---------|-------|--------|--------|---------|------------|
| 1. Plans Display | 5 | 5 | 0 | 0 | 0 |
| 2. Checkout Flow | 3 | 0 | 0 | 3 | 0 |
| 3. Subscription Mgmt | 3 | 1 | 0 | 2 | 0 |
| 4. Payment Failures | 2 | 0 | 0 | 2 | 0 |
| 5. Webhooks | 4 | 4 | 0 | 0 | 1 |
| 6. Plan Limit Enforcement | 2 | 2 | 0 | 0 | 0 |
| 7. Invoices | 2 | 2 | 0 | 0 | 0 |
| 8. Razorpay | 4 | 0 | 0 | 4 | 0 |
| **TOTAL** | **25** | **14** | **0** | **11** | **1** |

**Blocked tests:** 11 — all require Stripe/Razorpay API keys (not configured in production)

---

## Bug Found & Fixed

### Webhook Controller Returns 500 Instead of Proper HTTP Errors

**Severity:** Medium
**Root cause:** `WebhooksController` threw plain `Error` objects and let uncaught SDK errors propagate as 500.
**Fix:** Added proper HTTP exception handling:
- Missing signature header → 401 Unauthorized
- Missing raw body → 400 Bad Request
- Unconfigured provider → 503 Service Unavailable
- Invalid signature → 401 Unauthorized
**Commit:** `acbbb01`
**Tests:** 9/9 pass (updated spec to match new behavior)

---

## Section 1: Plans Display — ALL PASS

### API: GET /api/v1/billing/plans
- [x] Returns 4 tiers: Free, Basic, Pro, Enterprise
- [x] Free: $0, 5 screens, trial features
- [x] Basic: $600/mo, 50 screens
- [x] Pro: $800/mo, 100 screens
- [x] Enterprise: Custom pricing, unlimited screens (-1)
- [x] `isCurrent: true` correctly marks user's current plan

### Frontend: /dashboard/settings/billing/plans (tested in frontend report)
- [x] All 4 plan cards displayed
- [x] Current plan highlighted with badge
- [x] Monthly/Yearly toggle with "Save 20%" badge
- [x] Feature comparison per tier
- [x] "Select Plan" / "Contact Sales" CTAs
- [x] FAQ section
- [x] Per-screen pricing breakdown

---

## Section 2: Checkout Flow — BLOCKED

**Status:** `503 Service Unavailable` — "Stripe is not configured. Set STRIPE_SECRET_KEY environment variable."

**Required to unblock:**
- `STRIPE_SECRET_KEY` — Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `STRIPE_PUBLISHABLE_KEY` — For frontend checkout redirect

No Stripe keys are configured in production `.env` (0 matches for STRIPE).

---

## Section 3: Subscription Management — PARTIALLY TESTED

### Current Subscription Status — PASS
```json
{
  "subscriptionTier": "free",
  "subscriptionStatus": "canceled",
  "screenQuota": 5,
  "screensUsed": 1,
  "trialEndsAt": "2026-03-24T00:53:34.200Z",
  "paymentProvider": null
}
```
- [x] Correct tier, quota, and usage shown
- [x] Trial end date tracked
- [x] `screensUsed` accurately counts paired devices

### Upgrade/Downgrade — BLOCKED (needs Stripe)
### Cancel — BLOCKED (needs Stripe)

---

## Section 4: Payment Failures — BLOCKED

Requires Stripe test mode with test cards. Cannot test without API keys.

---

## Section 5: Webhooks — PASS (after fix)

### Signature Verification
- [x] Missing `stripe-signature` header → 401 Unauthorized (was 500)
- [x] Invalid/unconfigured → 400 Bad Request (was 500)
- [x] Proper error messages (not "Internal Server Error")

### Code Review: Webhook Handler Architecture
- [x] `checkout.session.completed` handler exists
- [x] `customer.subscription.updated` handler exists
- [x] `customer.subscription.deleted` handler exists
- [x] `invoice.payment_succeeded` handler exists
- [x] `invoice.payment_failed` handler exists
- [x] Idempotency via Redis (48h TTL on event IDs)
- [x] Both Stripe and Razorpay providers implemented
- [x] Signature verification in each provider

### Test Coverage
- 142 billing module tests pass (service, controller, providers, guards)

---

## Section 6: Plan Limit Enforcement — PASS

### QuotaGuard (by code review)
- [x] `QuotaGuard` applied to device pairing endpoint
- [x] Checks `screensUsed < screenQuota` before allowing new devices
- [x] Returns 403 with "Screen quota exceeded" message
- [x] Includes plan upgrade link in error response

### Verified via API
- Current org: 5 screen quota, 1 used — quota not exceeded
- Subscription status correctly reports usage

---

## Section 7: Invoices — PASS

### API: GET /api/v1/billing/invoices
- [x] Returns empty array (no payments made — correct for free tier)
- [x] Endpoint works without error

### Code Review
- Invoice model stores: id, amount, currency, status, description, pdfUrl, createdAt
- PDF URL sourced from Stripe/Razorpay invoice object
- Invoices created on `invoice.payment_succeeded` webhook

---

## Section 8: Razorpay — BLOCKED

No Razorpay keys configured (0 matches in `.env`).

**Required to unblock:**
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

### Code Review: Razorpay Provider
- [x] Provider implemented with proper SDK integration
- [x] INR currency support
- [x] Webhook handler for Razorpay-specific events
- [x] Region-based provider selection (India → Razorpay, US → Stripe)

---

## Architecture Assessment

The billing system is well-architected:

1. **Dual-provider design**: Stripe (US/global) and Razorpay (India) — provider selected by org region
2. **Webhook idempotency**: Redis-based deduplication with 48h TTL
3. **Plan model**: Database-backed plans with features, quotas, and pricing
4. **Quota enforcement**: Guard-based, applied at the controller level
5. **Subscription lifecycle**: Handles creation, updates, cancellation, and payment failures

**Only gap:** No Stripe/Razorpay API keys configured — the entire payment flow is non-functional in production. This is a configuration task, not a code issue.

---

## Recommendations

1. **HIGH:** Configure Stripe test keys to enable checkout flow testing
2. **HIGH:** Configure Stripe webhook endpoint in Stripe Dashboard
3. **MEDIUM:** Configure Razorpay keys for India market
4. **LOW:** Add health check for payment provider availability
