/**
 * Vizora Autonomous Operations — Alerting & Notifications
 *
 * Provides logging, Slack alerts, email notifications, and dashboard
 * status updates. All notification channels are optional — they no-op
 * if the required environment variables are missing.
 *
 * Environment variables:
 *   SLACK_WEBHOOK_URL  — Slack incoming webhook URL
 *   SMTP_HOST          — SMTP server hostname
 *   SMTP_PORT          — SMTP port (default: 587)
 *   SMTP_USER          — SMTP username
 *   SMTP_PASS          — SMTP password
 *   SMTP_FROM          — Sender email address
 *   SMTP_TO            — Recipient email address(es), comma-separated
 */

import type { SystemStatus, Incident, RemediationAction } from './types.js';

// ─── Logging ────────────────────────────────────────────────────────────────

/**
 * Write a timestamped log line to stdout.
 * Format: `[ISO timestamp] [agent] message`
 */
export function log(agent: string, msg: string): void {
  const ts = new Date().toISOString();
  process.stdout.write(`[${ts}] [${agent}] ${msg}\n`);
}

// ─── Slack ──────────────────────────────────────────────────────────────────

/**
 * Send a Slack Block Kit alert on status change. No-op if SLACK_WEBHOOK_URL
 * is not set.
 *
 * @param status         Current system status
 * @param previousStatus Previous system status (for transition context)
 * @param openIncidents  Currently open incidents (top 5 shown)
 * @param fixedCount     Number of issues auto-fixed this cycle
 */
export async function sendSlackAlert(
  status: SystemStatus,
  previousStatus: SystemStatus | 'unknown',
  openIncidents: Incident[],
  fixedCount: number,
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
  if (!webhookUrl) return;

  const emoji =
    status === 'HEALTHY' ? ':large_green_circle:' :
    status === 'DEGRADED' ? ':large_yellow_circle:' :
    ':red_circle:';

  const headerText =
    status === 'HEALTHY' ? 'HEALTHY' :
    status === 'DEGRADED' ? 'DEGRADED' :
    'CRITICAL';

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} Vizora Ops: ${headerText}` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*Previous:* ${previousStatus} *Current:* ${status}`,
          `*Open incidents:* ${openIncidents.length} | *Auto-fixed:* ${fixedCount}`,
        ].join('\n'),
      },
    },
  ];

  // Critical incidents (top 5)
  const criticals = openIncidents.filter(i => i.severity === 'critical');
  if (criticals.length > 0) {
    const list = criticals
      .slice(0, 5)
      .map(i => `* *${i.type}*: ${i.message}`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Critical Incidents:*\n${list}${criticals.length > 5 ? `\n_...and ${criticals.length - 5} more_` : ''}`,
      },
    });
  }

  // Warning incidents (top 3, only if no criticals)
  const warnings = openIncidents.filter(i => i.severity === 'warning');
  if (warnings.length > 0 && criticals.length === 0) {
    const list = warnings
      .slice(0, 3)
      .map(i => `* *${i.type}*: ${i.message}`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Warnings:*\n${list}${warnings.length > 3 ? `\n_...and ${warnings.length - 3} more_` : ''}`,
      },
    });
  }

  // Auto-fixed summary
  if (fixedCount > 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Auto-remediated:* ${fixedCount} issue${fixedCount > 1 ? 's' : ''} fixed this cycle` },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Vizora Ops | ${new Date().toISOString()}`,
      },
    ],
  });

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) {
      log('alerting', `Slack webhook returned ${res.status}`);
    }
  } catch (err) {
    log('alerting', `Slack alert failed: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── Email ──────────────────────────────────────────────────────────────────

/**
 * Send an HTML email alert via SMTP. No-op if SMTP_HOST is not configured.
 * Uses dynamic import for nodemailer to avoid hard dependency.
 *
 * @param status        Current system status
 * @param openIncidents Currently open incidents
 * @param fixedCount    Number of issues auto-fixed this cycle
 */
export async function sendEmailAlert(
  status: SystemStatus,
  openIncidents: Incident[],
  fixedCount: number,
): Promise<void> {
  const host = process.env.SMTP_HOST || '';
  if (!host) return;

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || 'vizora-ops@vizora.cloud';
  const to = process.env.SMTP_TO || '';

  if (!to) {
    log('alerting', 'SMTP_TO not set — skipping email alert');
    return;
  }

  const criticals = openIncidents.filter(i => i.severity === 'critical');
  const warnings = openIncidents.filter(i => i.severity === 'warning');

  const statusColor =
    status === 'HEALTHY' ? '#2ecc71' :
    status === 'DEGRADED' ? '#f39c12' :
    '#e74c3c';

  const incidentRows = openIncidents
    .slice(0, 20)
    .map(
      i =>
        `<tr>
          <td style="padding:4px 8px;border:1px solid #ddd;">${i.severity.toUpperCase()}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;">${i.type}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(i.message)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;">${i.target}:${i.targetId}</td>
        </tr>`,
    )
    .join('\n');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="background:${statusColor};color:white;padding:12px 16px;margin:0;border-radius:4px 4px 0 0;">
        Vizora Ops: ${status}
      </h2>
      <div style="padding:16px;border:1px solid #ddd;border-top:none;border-radius:0 0 4px 4px;">
        <p><strong>Critical:</strong> ${criticals.length} | <strong>Warnings:</strong> ${warnings.length} | <strong>Auto-fixed:</strong> ${fixedCount}</p>
        ${
          openIncidents.length > 0
            ? `<table style="border-collapse:collapse;width:100%;font-size:13px;">
                <thead>
                  <tr style="background:#f5f5f5;">
                    <th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Severity</th>
                    <th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Type</th>
                    <th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Message</th>
                    <th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Target</th>
                  </tr>
                </thead>
                <tbody>${incidentRows}</tbody>
              </table>
              ${openIncidents.length > 20 ? `<p style="color:#888;">...and ${openIncidents.length - 20} more</p>` : ''}`
            : '<p style="color:#2ecc71;">No open incidents.</p>'
        }
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
        <p style="color:#888;font-size:12px;">Vizora Autonomous Operations | ${new Date().toISOString()}</p>
      </div>
    </div>
  `;

  try {
    // Dynamic import — nodemailer is optional
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to,
      subject: `[Vizora Ops] ${status} — ${criticals.length} critical, ${warnings.length} warnings`,
      html,
    });
  } catch (err) {
    log('alerting', `Email alert failed: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

/**
 * POST full ops state to the dashboard health endpoint.
 * No-op on any error — dashboard updates are best-effort.
 *
 * @param state  Full OpsState object (incidents, agentResults, remediations)
 * @param token  Bearer token for API auth
 */
export async function updateDashboard(
  state: { systemStatus: string; incidents: Incident[]; lastUpdated: string; lastRun?: Record<string, string>; recentRemediations?: RemediationAction[]; agentResults?: Record<string, unknown> },
  token: string,
): Promise<void> {
  const baseUrl = process.env.VALIDATOR_BASE_URL || 'http://localhost:3000';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`${baseUrl}/api/v1/health/ops-status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        systemStatus: state.systemStatus,
        lastUpdated: state.lastUpdated,
        lastRun: state.lastRun ?? {},
        incidents: state.incidents ?? [],
        recentRemediations: state.recentRemediations ?? [],
        agentResults: state.agentResults ?? {},
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      log('alerting', `Dashboard update returned ${res.status}`);
    }
  } catch {
    // Silently ignore — dashboard updates are best-effort
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
