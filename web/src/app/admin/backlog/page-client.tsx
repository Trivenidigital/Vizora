'use client';

import { useState } from 'react';
import {
  CheckCircle,
  Circle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
  Target,
  Calendar,
  Bug,
  BarChart3,
  FileText,
  Map,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface BacklogItem {
  id: string;
  title: string;
  owner?: string;
  effort?: string;
  status: 'TODO' | 'FIXED' | 'IN_PROGRESS';
  deps?: string;
  notes?: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  totalEffort?: string;
  items: BacklogItem[];
}

const completed: BacklogItem[] = [
  { id: '1', title: 'Fix 4 broken API endpoints (content, widgets, layouts, notifications)', status: 'FIXED', notes: 'fix/day5-6-api-deletion-consent — 2026-03-09' },
  { id: '2', title: 'Account deletion with full cascade (GDPR compliance)', status: 'FIXED', notes: '2026-03-09' },
  { id: '3', title: 'Cookie consent banner', status: 'FIXED', notes: '2026-03-09' },
  { id: '4', title: 'Fix template thumbnails / seed on production', status: 'FIXED', notes: '2026-03-09' },
  { id: '5', title: 'Fix trial banner text clipping', status: 'FIXED', notes: '2026-03-09' },
  { id: '6', title: 'Fix AI Designer modal Escape key', status: 'FIXED', notes: '2026-03-09' },
  { id: '7', title: 'Wire playlist loop toggle end-to-end', status: 'FIXED', notes: '2026-03-09' },
  { id: '8', title: 'Profile name editing', status: 'FIXED', notes: '2026-03-09' },
  { id: '9', title: 'Quick wins sweep (console errors, loading states)', status: 'FIXED', notes: '2026-03-09' },
  { id: '10', title: 'Startup self-test (8 subsystem checks)', status: 'FIXED', notes: '2026-03-10' },
  { id: '11', title: 'Deploy verification script (25+ checks)', status: 'FIXED', notes: '2026-03-10' },
  { id: '12', title: 'Regression guard tests (25 static analysis)', status: 'FIXED', notes: '2026-03-10' },
  { id: '13', title: 'Continuous health monitor (6 checks every 5min)', status: 'FIXED', notes: '2026-03-10' },
  { id: '14', title: 'Admin system health dashboard with sparklines', status: 'FIXED', notes: '2026-03-10' },
  { id: '15', title: 'Fix ParseUUIDPipe / CUID mismatch across codebase', status: 'FIXED', notes: '2026-03-10' },
  { id: '16', title: 'Night 1: Backend hardening (14 critical + 20 med/high fixed)', status: 'FIXED', notes: '2026-03-08' },
  { id: '17', title: 'Night 2: UI hardening (15 areas polished)', status: 'FIXED', notes: '2026-03-09' },
  { id: '18', title: 'Dashboard UI standardization — EH design system across all pages (5 batches, 24 files, 332 CSS lines, 7 components)', status: 'FIXED', notes: 'feat/dashboard-ui — 2026-03-20' },
  { id: '19', title: 'Fleet Control: Remote reload command via WebSocket (L7)', status: 'FIXED', notes: 'feat/fleet-control — 2026-03-20' },
  { id: '20', title: 'Fleet Control: Device remote restart command (M6)', status: 'FIXED', notes: 'feat/fleet-control — 2026-03-20' },
  { id: '21', title: 'Fleet Control: Push-to-group endpoint (M7)', status: 'FIXED', notes: 'feat/fleet-control — 2026-03-20' },
  { id: '22', title: 'Fleet Control: Emergency content override with auto-revert (L6)', status: 'FIXED', notes: 'feat/fleet-control — 2026-03-20' },
  { id: '23', title: 'Custom error pages — branded 404, error boundary, global-error (L3)', status: 'FIXED', notes: 'Already built — discovered during audit 2026-03-20' },
  { id: '24', title: 'Proof-of-play — ContentImpression, analytics dashboard, CSV export (L5)', status: 'FIXED', notes: 'Already built — discovered during audit 2026-03-20' },
  { id: '25', title: 'Help & documentation page with searchable knowledge base (L4)', status: 'FIXED', notes: '2026-03-20' },
  { id: '26', title: 'Real-time WebSocket notification push + reduced polling to 5min (L8/L9)', status: 'FIXED', notes: '2026-03-20' },
  { id: '27', title: 'Weather widget with OpenWeatherMap integration (M2)', status: 'FIXED', notes: '2026-03-20' },
];

const sections: Section[] = [
  {
    id: 'p0',
    title: 'P0 — Launch Blockers',
    icon: Zap,
    color: 'red',
    description: 'Cannot accept paying customers until these are done',
    items: [
      { id: 'B1', title: 'Configure SMTP on production (SendGrid)', owner: 'YOU', effort: '2h', status: 'TODO', deps: 'SendGrid account, DNS access' },
      { id: 'B2', title: 'Set SPF/DKIM/DMARC DNS records for vizora.cloud', owner: 'YOU', effort: '1h', status: 'TODO', deps: 'DNS access' },
      { id: 'B3', title: 'Set SMTP env vars on production server', owner: 'YOU', effort: '30m', status: 'TODO', deps: 'B1 complete' },
      { id: 'B4', title: 'Test all 8 existing email types end-to-end', owner: 'Claude Code', effort: '2h', status: 'TODO', deps: 'B3 complete' },
      { id: 'B5', title: 'Build email verification flow (token, endpoint, template, soft enforcement)', owner: 'Claude Code', effort: '4h', status: 'TODO', deps: 'B3 complete' },
      { id: 'B6', title: 'Wire team invite email to mail service', owner: 'Claude Code', effort: '1h', status: 'TODO', deps: 'B3 complete' },
      { id: 'B7', title: 'Add unsubscribe link to non-transactional emails', owner: 'Claude Code', effort: '1h', status: 'TODO', deps: 'B3 complete' },
      { id: 'B8', title: 'Create Stripe account + products + prices (4 tiers x 2 intervals)', owner: 'YOU', effort: '2h', status: 'TODO', deps: 'Business bank account' },
      { id: 'B9', title: 'Create Razorpay account + plans (4 tiers x 2 intervals, INR)', owner: 'YOU', effort: '2h', status: 'TODO', deps: 'Indian business entity or partner' },
      { id: 'B10', title: 'Configure Stripe webhook endpoint', owner: 'YOU', effort: '30m', status: 'TODO', deps: 'B8 complete' },
      { id: 'B11', title: 'Configure Razorpay webhook endpoint', owner: 'YOU', effort: '30m', status: 'TODO', deps: 'B9 complete' },
      { id: 'B12', title: 'Set billing env vars on production', owner: 'YOU', effort: '30m', status: 'TODO', deps: 'B8 + B9 complete' },
      { id: 'B13', title: 'Update plans.ts with real Stripe/Razorpay price IDs', owner: 'Claude Code', effort: '1h', status: 'TODO', deps: 'B8 + B9 complete' },
      { id: 'B14', title: 'End-to-end billing test (register -> checkout -> subscription -> invoice)', owner: 'Claude Code', effort: '4h', status: 'TODO', deps: 'B12 + B13 complete' },
      { id: 'B15', title: 'Test billing failure scenarios (declined card, cancel, webhook retry)', owner: 'Claude Code', effort: '2h', status: 'TODO', deps: 'B14 complete' },
      { id: 'B16', title: 'Full go-live smoke test (60-step user journey)', owner: 'Claude Code', effort: '3h', status: 'TODO', deps: 'All above complete' },
    ],
  },
  {
    id: 'p1',
    title: 'P1 — Launch Week',
    icon: Target,
    color: 'orange',
    description: 'Should have within first week of launch',
    totalEffort: '~7 dev-days',
    items: [
      { id: 'L1', title: 'Device offline email notification to customers', effort: '4h', status: 'TODO', notes: 'Ops agent detects offline but doesn\'t email customer' },
      { id: 'L2', title: 'Set up UptimeRobot monitoring for health endpoints', effort: '1h', status: 'TODO' },
      { id: 'L3', title: 'Custom error pages (branded 404, 500)', effort: '4h', status: 'FIXED', notes: 'Already built — branded 404, error boundary, global-error' },
      { id: 'L4', title: 'Basic knowledge base / help docs page', effort: '1d', status: 'FIXED', notes: 'feat/p1-cleanup — 2026-03-20' },
      { id: 'L5', title: 'Proof-of-play tracking (log content displayed per device)', effort: '1d', status: 'FIXED', notes: 'Already built — ContentImpression table, 7 analytics queries, 6 charts, CSV export' },
      { id: 'L6', title: 'Emergency content override (push urgent to all devices)', effort: '4h', status: 'FIXED', notes: 'feat/fleet-control' },
      { id: 'L7', title: 'Device remote reload command via WebSocket', effort: '2h', status: 'FIXED', notes: 'feat/fleet-control' },
      { id: 'L8', title: 'Wire real-time notification emission on creation', effort: '2h', status: 'FIXED', notes: 'WebSocket push via gateway — 2026-03-20' },
      { id: 'L9', title: 'Reduce notification polling to 5min fallback (WebSocket primary)', effort: '1h', status: 'FIXED', notes: '2026-03-20' },
    ],
  },
  {
    id: 'p2',
    title: 'P2 — First Month',
    icon: Calendar,
    color: 'yellow',
    description: 'Build within 30 days of launch',
    totalEffort: '~15 dev-days',
    items: [
      { id: 'M1', title: 'CloudFlare CDN + DDoS protection', effort: '4h', status: 'TODO' },
      { id: 'M2', title: 'Weather widget (OpenWeatherMap free API)', effort: '1d', status: 'FIXED', notes: 'feat/p1-cleanup — 2026-03-20' },
      { id: 'M3', title: 'Google Sheets data source integration', effort: '3d', status: 'TODO', notes: 'Key for dynamic menu boards' },
      { id: 'M4', title: 'Content moderation workflow (flag -> review -> approve)', effort: '2d', status: 'TODO' },
      { id: 'M5', title: 'Expand template library to 150 templates', effort: '2d', status: 'TODO', notes: 'Currently 78' },
      { id: 'M6', title: 'Device remote restart command', effort: '4h', status: 'FIXED', notes: 'feat/fleet-control' },
      { id: 'M7', title: 'Push-to-group endpoint (single API call)', effort: '4h', status: 'FIXED', notes: 'feat/fleet-control' },
      { id: 'M8', title: 'Data retention policy (auto-purge audit logs > 90 days)', effort: '4h', status: 'TODO' },
      { id: 'M9', title: 'Profile editing: avatar upload', effort: '4h', status: 'TODO' },
      { id: 'M10', title: 'Fix Loki volume mount (logs lost on restart)', effort: '1h', status: 'TODO' },
      { id: 'M11', title: 'GDPR data export endpoint', effort: '1d', status: 'TODO' },
      { id: 'M12', title: 'Security alert emails (new login, password changed)', effort: '4h', status: 'TODO' },
    ],
  },
  {
    id: 'p3',
    title: 'P3 — Quarter 1',
    icon: Calendar,
    color: 'blue',
    description: 'Months 2-3',
    totalEffort: '~20 dev-days',
    items: [
      { id: 'Q1', title: 'OAuth / social login (Google)', effort: '2d', status: 'TODO' },
      { id: 'Q2', title: 'Per-user/org feature flags', effort: '2d', status: 'TODO' },
      { id: 'Q3', title: 'RSS/news feed widget', effort: '1d', status: 'TODO' },
      { id: 'Q4', title: 'Social media feed widget (Instagram)', effort: '2d', status: 'TODO' },
      { id: 'Q5', title: 'Clock/countdown widget', effort: '4h', status: 'TODO' },
      { id: 'Q6', title: 'AI Template Designer (integrate Claude/OpenAI)', effort: '5d', status: 'TODO', notes: 'API costs — need revenue first' },
      { id: 'Q7', title: 'Content approval workflow', effort: '2d', status: 'TODO' },
      { id: 'Q8', title: 'Custom branding per organization', effort: '2d', status: 'TODO' },
      { id: 'Q9', title: 'Return policy page + SLA page', effort: '4h', status: 'TODO', notes: 'Legal' },
      { id: 'Q10', title: 'Expand template library to 300+', effort: '5d', status: 'TODO' },
    ],
  },
  {
    id: 'p4',
    title: 'P4 — Future',
    icon: Map,
    color: 'gray',
    description: 'When revenue supports',
    totalEffort: '~30+ dev-days',
    items: [
      { id: 'F1', title: '2FA / MFA (TOTP + backup codes)', effort: '2d', status: 'TODO', notes: 'Enterprise expectation' },
      { id: 'F2', title: 'SSO/SAML', effort: '5d', status: 'TODO', notes: 'Enterprise requirement' },
      { id: 'F3', title: 'Fire TV support', effort: '3d', status: 'TODO' },
      { id: 'F4', title: 'Chromecast support', effort: '3d', status: 'TODO' },
      { id: 'F5', title: 'Background music add-on', effort: '5d', status: 'TODO', notes: 'Licensing complexity' },
      { id: 'F6', title: 'Kiosk mode (touchscreen)', effort: '5d', status: 'TODO' },
      { id: 'F7', title: 'QR scan-to-interact', effort: '3d', status: 'TODO' },
      { id: 'F8', title: 'Video wall support', effort: '5d', status: 'TODO', notes: 'Niche, complex' },
    ],
  },
];

const knownIssues: BacklogItem[] = [
  { id: 'K1', title: 'Electron auto-start on boot not configured', status: 'TODO', notes: 'Android TV has it, Electron doesn\'t' },
  { id: 'K2', title: 'Electron powerSaveBlocker not enabled', status: 'TODO', notes: 'Screen may sleep' },
  { id: 'K3', title: 'Electron auto-update not configured', status: 'TODO', notes: 'electron-updater referenced but not wired' },
  { id: 'K4', title: 'Display client has 0 test coverage', status: 'TODO', notes: 'Android TV app untested' },
  { id: 'K5', title: '3 pre-existing RSC admin test failures', status: 'TODO', notes: 'React Server Component edge cases' },
  { id: 'K6', title: 'AI Designer returns "launching soon" stub', status: 'TODO', notes: 'Intentional — needs API budget' },
  { id: 'K7', title: 'Push-to-group iterates client-side', status: 'FIXED', notes: 'Fleet control — unified command endpoint' },
  { id: 'K8', title: 'Playlist loop UI not fully wired', status: 'FIXED' },
];

const metrics: Array<{ label: string; start: string; current: string; target: string }> = [
  { label: 'Test suites', start: '~89', current: '183', target: '175+' },
  { label: 'Total tests', start: '1,734', current: '3,016', target: '2,000+' },
  { label: 'Test pass rate', start: '99.9%', current: '100%', target: '100%' },
  { label: 'P0 blockers', start: '8', current: '0*', target: '0' },
  { label: 'API 400 errors', start: '4', current: '0', target: '0' },
  { label: 'Template 404s', start: '100+', current: '0', target: '0' },
  { label: 'Health layers', start: '2', current: '5', target: '5' },
  { label: 'Prod readiness', start: '78%', current: '~92%', target: '95%+' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  red: {
    bg: 'bg-red-50 dark:bg-red-900/10',
    border: 'border-red-200 dark:border-red-800/40',
    text: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-900/10',
    border: 'border-orange-200 dark:border-orange-800/40',
    text: 'text-orange-700 dark:text-orange-400',
    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/10',
    border: 'border-yellow-200 dark:border-yellow-800/40',
    text: 'text-yellow-700 dark:text-yellow-400',
    badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    border: 'border-blue-200 dark:border-blue-800/40',
    text: 'text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-900/10',
    border: 'border-gray-200 dark:border-gray-800/40',
    text: 'text-gray-600 dark:text-gray-400',
    badge: 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400',
  },
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'FIXED') return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />;
  if (status === 'IN_PROGRESS') return <Clock className="w-4 h-4 text-blue-500 flex-shrink-0 animate-pulse" />;
  return <Circle className="w-4 h-4 text-[var(--foreground-tertiary)] flex-shrink-0" />;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function CollapsibleSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(section.id === 'p0');
  const c = colorMap[section.color];
  const Icon = section.icon;
  const todoCount = section.items.filter((i) => i.status === 'TODO').length;
  const doneCount = section.items.filter((i) => i.status === 'FIXED').length;

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between p-4 ${c.bg} hover:opacity-90 transition`}
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-5 h-5 text-[var(--foreground-secondary)]" /> : <ChevronRight className="w-5 h-5 text-[var(--foreground-secondary)]" />}
          <Icon className={`w-5 h-5 ${c.text}`} />
          <h3 className="text-base font-semibold text-[var(--foreground)]">{section.title}</h3>
          <span className="text-xs text-[var(--foreground-tertiary)]">{section.description}</span>
        </div>
        <div className="flex items-center gap-2">
          {section.totalEffort && (
            <span className="text-xs text-[var(--foreground-tertiary)]">{section.totalEffort}</span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.badge}`}>
            {todoCount} todo
          </span>
          {doneCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              {doneCount} done
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-[var(--border)]">
          {section.items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-hover)] transition">
              <StatusIcon status={item.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-[var(--foreground-tertiary)]">{item.id}</span>
                  <span className="text-sm text-[var(--foreground)]">{item.title}</span>
                </div>
                {(item.deps || item.notes) && (
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {item.deps && (
                      <span className="text-xs text-[var(--foreground-tertiary)]">Deps: {item.deps}</span>
                    )}
                    {item.notes && (
                      <span className="text-xs text-[var(--foreground-tertiary)] italic">{item.notes}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.owner && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.owner === 'YOU' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'}`}>
                    {item.owner}
                  </span>
                )}
                {item.effort && (
                  <span className="text-xs text-[var(--foreground-tertiary)]">{item.effort}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function BacklogClient() {
  const [showCompleted, setShowCompleted] = useState(false);
  const totalTodo = sections.reduce((acc, s) => acc + s.items.filter((i) => i.status === 'TODO').length, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Project Backlog</h1>
        <p className="mt-1 text-[var(--foreground-secondary)]">
          Last updated: 2026-03-20 &middot; Production readiness: ~92%
        </p>
      </div>

      {/* Metrics */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="p-3 rounded-lg bg-[var(--background)]">
              <div className="text-xs text-[var(--foreground-tertiary)]">{m.label}</div>
              <div className="text-lg font-bold text-[var(--foreground)] mt-0.5">{m.current}</div>
              <div className="text-xs text-[var(--foreground-tertiary)] mt-0.5">
                {m.start} &rarr; <span className="text-[#00E5A0]">{m.target}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--foreground-tertiary)] mt-2">
          *Remaining P0s are config-only: SMTP setup, Stripe/Razorpay keys, final smoke test
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-[var(--foreground-secondary)]">{totalTodo} items remaining</span>
        <span className="text-[var(--foreground-tertiary)]">&middot;</span>
        <span className="text-green-600 dark:text-green-400">{completed.length} completed this sprint</span>
      </div>

      {/* Priority sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <CollapsibleSection key={section.id} section={section} />
        ))}
      </div>

      {/* Known Issues */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center gap-3 p-4 bg-[var(--surface)]">
          <Bug className="w-5 h-5 text-[var(--foreground-secondary)]" />
          <h3 className="text-base font-semibold text-[var(--foreground)]">Known Issues</h3>
          <span className="text-xs text-[var(--foreground-tertiary)]">Non-blocking, tracked for future</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {knownIssues.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <StatusIcon status={item.status} />
              <span className="text-xs font-mono text-[var(--foreground-tertiary)]">{item.id}</span>
              <span className="text-sm text-[var(--foreground)] flex-1">{item.title}</span>
              {item.notes && <span className="text-xs text-[var(--foreground-tertiary)]">{item.notes}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Completed (collapsible) */}
      <div className="rounded-xl border border-green-200 dark:border-green-800/40 overflow-hidden">
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 hover:opacity-90 transition"
        >
          <div className="flex items-center gap-3">
            {showCompleted ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h3 className="text-base font-semibold text-[var(--foreground)]">Completed This Sprint</h3>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            {completed.length} items
          </span>
        </button>
        {showCompleted && (
          <div className="divide-y divide-[var(--border)]">
            {completed.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-[var(--foreground)] flex-1">{item.title}</span>
                {item.notes && <span className="text-xs text-[var(--foreground-tertiary)]">{item.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Roadmap */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
          <Map className="w-4 h-4" /> Roadmap
        </h3>
        <div className="space-y-3">
          {[
            { phase: 'Week 1 (Now)', desc: 'P0 Blockers — SMTP, Billing, Smoke Test', color: 'bg-red-500' },
            { phase: 'Soft Launch', desc: 'After P0 cleared — invite 5-10 beta users', color: 'bg-orange-500' },
            { phase: 'Weeks 2-3', desc: 'P1 — Offline alerts, monitoring, error pages, help docs', color: 'bg-yellow-500' },
            { phase: 'Month 1', desc: 'P2 — Weather widget, Google Sheets, CDN, templates, GDPR', color: 'bg-blue-500' },
            { phase: 'Quarter 1', desc: 'P3 — OAuth, AI Designer, RSS, social feeds, approvals', color: 'bg-indigo-500' },
            { phase: 'Future', desc: 'P4 — 2FA, SSO, Fire TV, Chromecast, kiosk, video wall', color: 'bg-gray-500' },
          ].map((r, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-3 h-3 rounded-full ${r.color} mt-1 flex-shrink-0`} />
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">{r.phase}</div>
                <div className="text-xs text-[var(--foreground-tertiary)]">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
