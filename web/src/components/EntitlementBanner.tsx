'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { EntitlementBanner as EntitlementBannerData } from '@/lib/types';
import {
  BANNER_ACTION,
  BANNER_MESSAGE,
  BANNER_QUIET_ACTION,
  BANNER_ROW,
  BANNER_TONE,
  type BannerTone,
} from './banner-tones';

/**
 * B3 — the dashboard-first escalation channel for the entitlement degrade ladder.
 *
 * The ladder darkens screens only at the LAST rung (suspended); this banner is
 * what applies pressure to the owner during the preceding two weeks. It renders
 * escalating urgency for past_due → publish_locked → suspended, with the days
 * remaining until the next rung. Without it, days 0–13 of the ladder are silent —
 * which is the whole reason it ships with the ladder, not after.
 *
 * Non-ladder states (active/trial/canceled) render nothing here — trial is owned
 * by TrialBanner, and the two never overlap (ladder states sit on a paid tier).
 *
 * A FAILED read renders a degraded notice, never silence (B5). The population
 * this banner exists for — past_due / publish_locked / suspended — is exactly
 * the population a swallowed error used to leave with no warning at all, and a
 * blank bar is indistinguishable from a healthy account. Same semantic model as
 * the billing page (#350): a read that succeeded renders the real state, a read
 * that failed renders an explicitly unknown state, and neither ever renders a
 * fabricated benign one.
 */
export default function EntitlementBanner() {
  const [data, setData] = useState<EntitlementBannerData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    // The error is cleared on SUCCESS, not on attempt — clearing it here would
    // blank the notice for a tick and re-show it on every failed retry.
    apiClient
      .getEntitlementBanner()
      .then((banner) => {
        setData(banner);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        setLoadError(
          (err instanceof Error && err.message) || 'The subscription status request failed',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Self-heal on network restore. `ApiClient.request` retries only AbortError
  // (timeouts) and replays once through /auth/refresh on a 401 — a dropped
  // connection rejects with a plain `TypeError: Failed to fetch` and reaches us
  // un-retried. Since the notice is not dismissible, without this it would sit
  // over a healthy org's dashboard for the whole session unless they hit Retry.
  useEffect(() => {
    const onOnline = () => load();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [load]);

  // Degraded — state UNKNOWN. Neutral tone, and it asserts nothing about the
  // account beyond the fact that we could not check it.
  //
  // NOT dismissible, for the same reason publish_locked isn't: this state may be
  // masking a rung, so it is load-bearing. Dismissing it would restore exactly
  // the silence this fixes — and permanently, since the retry lives inside the
  // notice, so a dismissal would also throw away the only recovery route.
  if (loadError) {
    return (
      <DegradedNotice
        detail={`Any billing warning that applies to your account is missing from this bar until it loads. (${loadError})`}
        onRetry={load}
        loading={loading}
      />
    );
  }

  if (!data) return null;

  const { status, daysUntilNextRung } = data;

  // The SERVER's own degraded sentinel: getBannerState returns status 'unknown'
  // when it cannot read the org row, i.e. "I could not determine this". Rendering
  // nothing for it is the same silent failure as swallowing the fetch error, one
  // layer back — so it gets the same degraded notice, worded for a server-side
  // determination failure rather than a transport one.
  if (status === 'unknown') {
    return (
      <DegradedNotice
        detail="We couldn’t determine your account’s billing state, so any warning that applies to it is missing from this bar."
        onRetry={load}
        loading={loading}
      />
    );
  }
  const days = daysUntilNextRung ?? 0;
  const dayLabel = days === 1 ? 'day' : 'days';

  // past_due — screens still play; dismissible (least urgent rung).
  if (status === 'past_due' && !dismissed) {
    return (
      <BannerShell
        tone="warning"
        message={<><strong>Payment past due.</strong><span className="hidden sm:inline">{' '}Your screens are still playing — publishing pauses in {days} {dayLabel} if unpaid.</span></>}
        actions={<><PayLink tone="warning" /><DismissButton tone="warning" onClick={() => setDismissed(true)} /></>}
      />
    );
  }

  // publish_locked — screens still play, but no new content can be pushed. NOT
  // dismissible: it explains why publishing is failing.
  if (status === 'publish_locked') {
    return (
      <BannerShell
        tone="urgent"
        message={<><strong>Publishing paused — billing past due.</strong><span className="hidden sm:inline">{' '}Your screens keep playing their current content; you can&rsquo;t push new content until you update billing. Screens pause in {days} {dayLabel}.</span></>}
        actions={<PayLink tone="urgent" />}
      />
    );
  }

  // suspended — screens are on a holding page. Most urgent; not dismissible.
  if (status === 'suspended') {
    return (
      <BannerShell
        tone="critical"
        message={<><strong>Your screens are paused.</strong><span className="hidden sm:inline">{' '}Update your billing to bring them back online.</span></>}
        actions={<PayLink tone="critical" label="Update Billing" />}
      />
    );
  }

  return null;
}

/**
 * The escalation ladder, in the shared tone vocabulary (`banner-tones.ts`).
 *
 * `unknown` is the degraded tone — NOT a ladder rung, so it must not read as
 * one of the escalating warnings. That constraint predates this file and is
 * restated at the definition site.
 */
function BannerShell({ tone, message, actions }: { tone: BannerTone; message: React.ReactNode; actions: React.ReactNode }) {
  const t = BANNER_TONE[tone];
  return (
    <div className={t.bar} role="alert">
      <div className={BANNER_ROW}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 ${t.dot} rounded-full animate-pulse shrink-0`} />
          <p className={`${BANNER_MESSAGE} ${t.text}`}>{message}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      </div>
    </div>
  );
}

function PayLink({ tone, label = 'Update Payment' }: { tone: BannerTone; label?: string }) {
  return (
    <Link
      href="/dashboard/settings/billing/plans"
      className={`${BANNER_ACTION} ${BANNER_TONE[tone].action}`}
    >
      {label}
    </Link>
  );
}

/**
 * The one degraded/unknown rendering, shared by both ways the state can be
 * unknown: the read failed in transit, or the server told us it could not
 * determine it. Neither may render as silence or as a benign state.
 */
function DegradedNotice({
  detail,
  onRetry,
  loading,
}: {
  detail: string;
  onRetry: () => void;
  loading: boolean;
}) {
  return (
    <BannerShell
      tone="unknown"
      message={
        <>
          <strong>Couldn&rsquo;t check your subscription status.</strong>
          <span className="hidden sm:inline">{' '}{detail}</span>
        </>
      }
      actions={<RetryButton onClick={onRetry} loading={loading} />}
    />
  );
}

function RetryButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`${BANNER_QUIET_ACTION} ${BANNER_TONE.unknown.quiet}`}
    >
      {loading ? 'Retrying…' : 'Retry'}
    </button>
  );
}

function DismissButton({ tone, onClick }: { tone: BannerTone; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`p-1.5 ${BANNER_TONE[tone].text} opacity-60 hover:opacity-100 transition`} aria-label="Dismiss">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
