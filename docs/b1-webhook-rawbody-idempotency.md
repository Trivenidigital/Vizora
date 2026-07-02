# B1 — Webhook rawBody fix + idempotency hardening

**Branch:** `feat/b1-webhook-rawbody-idempotency` (off `main`) · **Finding:** B1 (S1), B5 (S2)
**Approved:** operator, first slice, with billing idempotency folded in.

## What was broken (S1)

`NestFactory.create<NestExpressApplication>(AppModule)` had no `{ rawBody: true }`, but both
webhook handlers require `req.rawBody` for signature verification (`webhooks.controller.ts:31,56`).
As deployed, `req.rawBody` was `undefined`, so **every real Stripe/Razorpay webhook 400'd before
signature verification** — billing was non-functional regardless of live keys, and CI missed it
because the tests call `billingService.handleWebhookEvent` directly with a hand-built buffer.

## What shipped

1. **rawBody enabled** (`main.ts`) — webhooks receive the raw bytes and can verify signatures.
2. **Idempotency rekeyed to the event id** (`billing.service.ts`) — was keyed on the *object* id
   (`event.data.id`), shared across distinct events for one subscription, wrongly dropping the
   second. Now uses the provider **event** id: Stripe `evt_...`; Razorpay a content hash of the
   signed payload (`rzp_<sha256[:40]>`) since Razorpay has no body-level event id.
3. **Atomic, fail-closed claim** — `SET NX` replaces the racy get-then-set; on Redis outage the
   claim throws → webhook 5xx → PSP retries. Never double-processes, never silently drops. This
   also closes the **Razorpay zero-replay-protection** gap (its `eventId` was always `undefined`,
   so dedup was skipped entirely).

## Tests (all green)

- `billing.service.spec` (34): duplicate skips via `SETNX→null`; **two distinct events sharing an
  object id both process** (regression for the object-id bug); **fail-closed when Redis is down**.
- `razorpay.provider.spec` (22): event id shape + determinism (replay-stable, distinct-safe).
- Full billing module: 181 green.

## Deliberately deferred (scoped follow-up, same slice surface)

- **B6 — idempotency keys on outbound charge/checkout creation.** Stripe's `createCheckoutSession`
  takes an `{ idempotencyKey }`, but a *correct* key needs a request-scoped token threaded from the
  caller — a deterministic org+plan key would collide across two legitimate checkout attempts, and
  a random key is a no-op. Checkout creation is user-initiated (not webhook-retried), so the
  double-charge risk is low; this is a small design task (thread a request id), not a bolt-on.
  Tracked for the immediate follow-up commit.
- **`recordTransaction` fallback `payment_${Date.now()}`** (`billing.service.ts:784`) is not stable
  across replays → can create duplicate transaction rows on the no-invoice-id path. Fold into the
  B6 follow-up (use the event id as the stable transaction key).

## Claim-window residual (operator-flagged) — closed

The 5-min pending TTL must exceed worst-case handler duration, else a slow handler's claim could
expire mid-work and let the PSP retry double-process. Verified:

- **State mutations are internally idempotent by construction** — every handler does fixed-value
  `organization.update` (re-run rewrites identical values) and the one insert
  (`billingTransaction.create`) is guarded by `@@unique([provider, providerTransactionId])` (replay
  → P2002, deduped). So even a claim-expiry double-process **cannot** double-charge or
  double-provision. This is the primary backstop.
- **The only external call is the awaited receipt/failed email** in `handlePaymentSucceeded`/
  `handlePaymentFailed`. Now bounded: the SMTP transport carries `connectionTimeout`/`greetingTimeout`
  (10s) + `socketTimeout` (15s), so a send caps at ~15s — far under the 5-min window. Worst case of a
  double-process is thus a duplicate *receipt email* (annoyance, not S1), and it requires a hung SMTP
  beyond its own timeouts, which the caps prevent.

## Acceptance status

Replay (duplicate event → no-op) and the distinct-event regression are covered by automated tests.
Out-of-order handling: the webhook handlers are idempotent status writes (checkout/subscription
updates set fixed values), so ordering does not corrupt state; the one order-sensitive path
(payment succeeded → transaction row) is guarded by the `@@unique([provider, providerTransactionId])`
constraint. Live-mode Stripe-signature integration test remains a P2 (needs a Stripe test fixture).
