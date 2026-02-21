import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD required). ' +
        'Email sending is disabled. Password reset links will be logged to console.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  private get fromAddress(): string {
    return process.env.EMAIL_FROM || 'noreply@vizora.cloud';
  }

  private get appUrl(): string {
    return process.env.APP_URL || 'http://localhost:3001';
  }

  private get upgradeUrl(): string {
    return `${this.appUrl}/dashboard/settings/billing/plans`;
  }

  private get dashboardUrl(): string {
    return `${this.appUrl}/dashboard`;
  }

  /**
   * Shared helper: sends an email or logs to console in dev mode.
   * Returns silently on failure — never throws.
   */
  private async sendMail(
    to: string,
    subject: string,
    html: string,
    logLabel: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`[DEV] ${logLabel} email for ${to} (SMTP not configured)`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      this.logger.log(`${logLabel} email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send ${logLabel} email to ${to}:`, error);
    }
  }

  // ---------------------------------------------------------------------------
  // Shared email shell — wraps content in Vizora-branded responsive layout
  // ---------------------------------------------------------------------------
  private wrapInTemplate(bodyContent: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#061A21;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#061A21;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#0C2229;border-radius:12px;border:1px solid #1B3D47;overflow:hidden;">
        <!-- Header / Logo -->
        <tr><td style="padding:32px 32px 24px 32px;">
          <div style="display:inline-flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:8px;background:rgba(0,229,160,0.1);border:1px solid rgba(0,229,160,0.2);text-align:center;line-height:28px;">
              <span style="color:#00E5A0;font-weight:bold;font-size:12px;font-family:monospace;">V</span>
            </div>
            <span style="color:#F0ECE8;font-weight:600;font-size:14px;">Vizora</span>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:0 32px 32px 32px;">
          ${bodyContent}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #1B3D47;">
          <p style="color:#5A6B73;font-size:11px;margin:0 0 4px 0;">Vizora Digital Signage Platform &middot; vizora.cloud</p>
          <p style="color:#3E4E55;font-size:10px;margin:0;">You are receiving this because you have an account with Vizora. To unsubscribe from non-essential emails, visit your account settings.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private ctaButton(label: string, href: string): string {
    return `<a href="${href}" style="display:inline-block;background:#00E5A0;color:#061A21;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">${label}</a>`;
  }

  // ---------------------------------------------------------------------------
  // Billing emails
  // ---------------------------------------------------------------------------

  async sendWelcomeEmail(
    to: string,
    firstName: string,
    trialDaysRemaining: number,
  ): Promise<void> {
    const subject = 'Welcome to Vizora!';
    const html = this.wrapInTemplate(`
          <h1 style="color:#F0ECE8;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome to Vizora, ${firstName}!</h1>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Your account is ready. You have <strong style="color:#00E5A0;">${trialDaysRemaining} days</strong> of full access
            on your free trial — no credit card required.
          </p>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 8px 0;">Here's how to get started:</p>
          <ol style="color:#8A9BA3;font-size:14px;line-height:1.8;margin:0 0 24px 0;padding-left:20px;">
            <li>Upload your first piece of content</li>
            <li>Pair a display device</li>
            <li>Create a playlist and assign it to a schedule</li>
          </ol>
          ${this.ctaButton('Go to Dashboard', this.dashboardUrl)}
          <p style="color:#5A6B73;font-size:12px;line-height:1.5;margin:16px 0 0 0;">
            Need help? Reply to this email or check our documentation.
          </p>
    `);
    await this.sendMail(to, subject, html, 'Welcome');
  }

  async sendTrialReminderEmail(
    to: string,
    firstName: string,
    daysRemaining: number,
  ): Promise<void> {
    const urgency = daysRemaining <= 2 ? 'expires very soon' : 'is ending soon';
    const subject = `Your Vizora trial ${urgency} — ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`;
    const html = this.wrapInTemplate(`
          <h1 style="color:#F0ECE8;font-size:22px;font-weight:700;margin:0 0 8px 0;">Your trial ${urgency}</h1>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hi ${firstName},<br><br>
            You have <strong style="color:#00E5A0;">${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong> remaining on your
            Vizora free trial. After that, you'll lose access to premium features including multi-display management and advanced scheduling.
          </p>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Upgrade now to keep everything running without interruption.
          </p>
          ${this.ctaButton('View Plans & Upgrade', this.upgradeUrl)}
          <p style="color:#5A6B73;font-size:12px;line-height:1.5;margin:16px 0 0 0;">
            If you've already upgraded, you can safely ignore this email.
          </p>
    `);
    await this.sendMail(to, subject, html, 'Trial reminder');
  }

  async sendTrialExpiredEmail(
    to: string,
    firstName: string,
  ): Promise<void> {
    const subject = 'Your Vizora trial has ended';
    const html = this.wrapInTemplate(`
          <h1 style="color:#F0ECE8;font-size:22px;font-weight:700;margin:0 0 8px 0;">Your trial has ended</h1>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hi ${firstName},<br><br>
            Your Vizora free trial has expired. Your account is still active, but premium features — including
            multi-display management, advanced scheduling, and priority support — are now limited.
          </p>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Upgrade today to restore full access and keep your signage running smoothly.
          </p>
          ${this.ctaButton('Upgrade Now', this.upgradeUrl)}
          <p style="color:#5A6B73;font-size:12px;line-height:1.5;margin:16px 0 0 0;">
            Your content and settings are preserved. Upgrading will instantly re-enable everything.
          </p>
    `);
    await this.sendMail(to, subject, html, 'Trial expired');
  }

  async sendPaymentReceiptEmail(
    to: string,
    firstName: string,
    planName: string,
    amount: string,
    currency: string,
  ): Promise<void> {
    const subject = `Payment received — Vizora ${planName}`;
    const html = this.wrapInTemplate(`
          <h1 style="color:#F0ECE8;font-size:22px;font-weight:700;margin:0 0 8px 0;">Payment received</h1>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hi ${firstName},<br><br>
            We've received your payment. Here's a summary:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr>
              <td style="padding:12px 16px;background:#0A1E26;border-radius:8px 8px 0 0;border-bottom:1px solid #1B3D47;">
                <span style="color:#5A6B73;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Plan</span><br>
                <span style="color:#F0ECE8;font-size:14px;font-weight:600;">${planName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;background:#0A1E26;border-radius:0 0 8px 8px;">
                <span style="color:#5A6B73;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Amount</span><br>
                <span style="color:#00E5A0;font-size:18px;font-weight:700;">${amount} ${currency.toUpperCase()}</span>
              </td>
            </tr>
          </table>
          ${this.ctaButton('Go to Dashboard', this.dashboardUrl)}
          <p style="color:#5A6B73;font-size:12px;line-height:1.5;margin:16px 0 0 0;">
            This serves as your payment receipt. For invoicing needs, visit your billing settings.
          </p>
    `);
    await this.sendMail(to, subject, html, 'Payment receipt');
  }

  async sendPaymentFailedEmail(
    to: string,
    firstName: string,
  ): Promise<void> {
    const subject = 'Action required — Vizora payment failed';
    const html = this.wrapInTemplate(`
          <h1 style="color:#F0ECE8;font-size:22px;font-weight:700;margin:0 0 8px 0;">Payment failed</h1>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hi ${firstName},<br><br>
            We were unable to process your latest payment for your Vizora subscription.
            Please update your payment method to avoid service interruption.
          </p>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            We'll automatically retry in a few days, but updating your card now ensures uninterrupted access.
          </p>
          ${this.ctaButton('Update Payment Method', this.upgradeUrl)}
          <p style="color:#5A6B73;font-size:12px;line-height:1.5;margin:16px 0 0 0;">
            If you believe this is an error, please contact your card issuer or reply to this email.
          </p>
    `);
    await this.sendMail(to, subject, html, 'Payment failed');
  }

  async sendPlanChangedEmail(
    to: string,
    firstName: string,
    oldPlan: string,
    newPlan: string,
  ): Promise<void> {
    const subject = `Plan updated — now on Vizora ${newPlan}`;
    const html = this.wrapInTemplate(`
          <h1 style="color:#F0ECE8;font-size:22px;font-weight:700;margin:0 0 8px 0;">Plan updated</h1>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hi ${firstName},<br><br>
            Your Vizora subscription has been changed:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr>
              <td style="padding:12px 16px;background:#0A1E26;border-radius:8px;display:flex;align-items:center;gap:12px;">
                <div>
                  <span style="color:#5A6B73;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Previous</span><br>
                  <span style="color:#8A9BA3;font-size:14px;text-decoration:line-through;">${oldPlan}</span>
                </div>
                <div style="color:#5A6B73;font-size:18px;padding:0 8px;">&rarr;</div>
                <div>
                  <span style="color:#5A6B73;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">New plan</span><br>
                  <span style="color:#00E5A0;font-size:14px;font-weight:600;">${newPlan}</span>
                </div>
              </td>
            </tr>
          </table>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Your new plan features are available immediately.
          </p>
          ${this.ctaButton('Go to Dashboard', this.dashboardUrl)}
    `);
    await this.sendMail(to, subject, html, 'Plan changed');
  }

  async sendSubscriptionCanceledEmail(
    to: string,
    firstName: string,
    accessUntil: string,
  ): Promise<void> {
    const subject = 'Your Vizora subscription has been canceled';
    const html = this.wrapInTemplate(`
          <h1 style="color:#F0ECE8;font-size:22px;font-weight:700;margin:0 0 8px 0;">Subscription canceled</h1>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hi ${firstName},<br><br>
            Your Vizora subscription has been canceled as requested. You'll continue to have full access to
            premium features until <strong style="color:#F0ECE8;">${accessUntil}</strong>.
          </p>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            After that date, your account will revert to the free tier. Your content and settings will be
            preserved — you can resubscribe at any time to restore full access.
          </p>
          ${this.ctaButton('Resubscribe', this.upgradeUrl)}
          <p style="color:#5A6B73;font-size:12px;line-height:1.5;margin:16px 0 0 0;">
            We'd love to have you back. If you canceled by mistake, you can resubscribe before your access period ends.
          </p>
    `);
    await this.sendMail(to, subject, html, 'Subscription canceled');
  }

  // ---------------------------------------------------------------------------
  // Legacy methods (pre-existing)
  // ---------------------------------------------------------------------------

  async sendPasswordResetEmail(
    to: string,
    firstName: string,
    resetUrl: string,
  ): Promise<void> {
    const from = process.env.EMAIL_FROM || 'noreply@vizora.cloud';
    const subject = 'Reset your Vizora password';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#061A21;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#061A21;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#0C2229;border-radius:12px;border:1px solid #1B3D47;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:32px 32px 24px 32px;">
          <div style="display:inline-flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:8px;background:rgba(0,229,160,0.1);border:1px solid rgba(0,229,160,0.2);text-align:center;line-height:28px;">
              <span style="color:#00E5A0;font-weight:bold;font-size:12px;font-family:monospace;">V</span>
            </div>
            <span style="color:#F0ECE8;font-weight:600;font-size:14px;">Vizora</span>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:0 32px 32px 32px;">
          <h1 style="color:#F0ECE8;font-size:22px;font-weight:700;margin:0 0 8px 0;">Reset your password</h1>
          <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hi ${firstName},<br><br>
            You requested a password reset for your Vizora account. Click the button below to create a new password.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:#00E5A0;color:#061A21;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
            Reset Password
          </a>
          <p style="color:#8A9BA3;font-size:13px;line-height:1.5;margin:24px 0 0 0;">
            This link expires in <strong style="color:#F0ECE8;">1 hour</strong> and can only be used once.
          </p>
          <p style="color:#5A6B73;font-size:12px;line-height:1.5;margin:16px 0 0 0;">
            If you didn't request this, you can safely ignore this email. Your password won't be changed.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #1B3D47;">
          <p style="color:#5A6B73;font-size:11px;margin:0;">The Vizora Team &middot; vizora.cloud</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    if (!this.transporter) {
      // Dev fallback: log the reset URL to console
      this.logger.warn(`[DEV] Password reset email for ${to}:`);
      this.logger.warn(`[DEV] Reset URL: ${resetUrl}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from, to, subject, html });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}:`, error);
      // Don't throw — we don't want to reveal email delivery failures to the user
    }
  }
}
