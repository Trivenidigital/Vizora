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
