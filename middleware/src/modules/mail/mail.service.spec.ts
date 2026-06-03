import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn() })),
}));

describe('MailService.escapeHtml', () => {
  it('escapes &, <, >, ", and \'', () => {
    expect(MailService.escapeHtml('a & b')).toBe('a &amp; b');
    expect(MailService.escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(MailService.escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    expect(MailService.escapeHtml("o'reilly")).toBe('o&#39;reilly');
  });

  it('escapes & first to avoid double-escaping', () => {
    expect(MailService.escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('returns empty string unchanged', () => {
    expect(MailService.escapeHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(MailService.escapeHtml('Lobby Display 01')).toBe('Lobby Display 01');
  });
});

describe('MailService SMTP config', () => {
  const originalEnv = process.env;

  const configureSmtp = () => {
    process.env.SMTP_HOST = 'smtp.resend.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'resend';
    process.env.SMTP_PASS = 'resend-secret';
  };

  const latestTransport = () =>
    (nodemailer.createTransport as jest.Mock).mock.results.at(-1)?.value as {
      sendMail: jest.Mock;
    };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('accepts SMTP_PASS as the documented password alias', () => {
    configureSmtp();

    new MailService();

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.resend.com',
        port: 587,
        secure: false,
        auth: { user: 'resend', pass: 'resend-secret' },
      }),
    );
  });

  it('uses EMAIL_FROM for default transactional sender', async () => {
    configureSmtp();
    process.env.EMAIL_FROM = 'Vizora Test <noreply@example.test>';
    const service = new MailService();

    await service.sendWelcomeEmail('user@example.com', 'Ada', 30);

    const message = latestTransport().sendMail.mock.calls[0][0];
    expect(message).toEqual(
      expect.objectContaining({
        from: 'Vizora Test <noreply@example.test>',
        to: 'user@example.com',
        subject: 'Welcome to Vizora!',
      }),
    );
    expect(message).not.toHaveProperty('replyTo');
  });

  it('falls back to the verified noreply sender when EMAIL_FROM is unset', async () => {
    configureSmtp();
    const service = new MailService();

    await service.sendWelcomeEmail('user@example.com', 'Ada', 30);

    const message = latestTransport().sendMail.mock.calls[0][0];
    expect(message).toEqual(
      expect.objectContaining({
        from: 'Vizora <noreply@mail.vizora.cloud>',
        to: 'user@example.com',
      }),
    );
  });

  it('keeps role-specific senders even when EMAIL_FROM is configured', async () => {
    configureSmtp();
    process.env.EMAIL_FROM = 'Vizora Test <noreply@example.test>';
    const service = new MailService();

    await service.sendTrialReminderEmail('user@example.com', 'Ada', 2);

    const message = latestTransport().sendMail.mock.calls[0][0];
    expect(message).toEqual(
      expect.objectContaining({
        from: 'Vizora Billing <billing@mail.vizora.cloud>',
        replyTo: 'billing@vizora.cloud',
        to: 'user@example.com',
      }),
    );
  });
});

describe('MailService.sendDeviceOfflineAlertEmail', () => {
  let service: MailService;
  let sendMailSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new MailService();
    // sendMail is private but accessible via type assertion for testing
    sendMailSpy = jest.spyOn(service as unknown as { sendMail: jest.Func }, 'sendMail').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends with deviceName escaped in subject and body', async () => {
    await service.sendDeviceOfflineAlertEmail('ops@example.com', '<bad>name</bad>');

    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    const [to, subject, html, label, sender] = sendMailSpy.mock.calls[0];

    expect(to).toBe('ops@example.com');
    // PR-review fix: subject MUST also be escaped — some clients render HTML
    // entities in subjects, and logging tools can choke on < or " in subjects.
    expect(subject).toBe('Device offline: &lt;bad&gt;name&lt;/bad&gt;');
    expect(html).toContain('&lt;bad&gt;name&lt;/bad&gt;');                    // body must be HTML-escaped too
    expect(html).not.toContain('<bad>name</bad>');                            // unescaped form MUST NOT appear
    expect(label).toBe('Device offline alert');
    expect(sender).toBe('noreply');
  });

  it('renders a CTA pointing at /dashboard/devices', async () => {
    await service.sendDeviceOfflineAlertEmail('ops@example.com', 'Lobby 1');

    const [, , html] = sendMailSpy.mock.calls[0];
    expect(html).toContain('/dashboard/devices');
    expect(html).toContain('View Devices');
  });

  it('passes deviceName with quote characters through escapeHtml', async () => {
    await service.sendDeviceOfflineAlertEmail('ops@example.com', 'a"b\'c');

    const [, , html] = sendMailSpy.mock.calls[0];
    expect(html).toContain('a&quot;b&#39;c');
  });
});

describe('MailService.sendUnrecognizedLoginEmail', () => {
  let service: MailService;
  let sendMailSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.APP_URL = 'https://app.vizora.test';
    service = new MailService();
    sendMailSpy = jest.spyOn(service as unknown as { sendMail: jest.Func }, 'sendMail').mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.APP_URL;
    jest.restoreAllMocks();
  });

  it('sends via the auth sender with account review CTA', async () => {
    await service.sendUnrecognizedLoginEmail('user@example.com', 'Ada', {
      ipAddress: '203.0.113.10',
      userAgent: 'Mozilla/5.0 Chrome/125.0',
      occurredAt: new Date('2026-05-31T12:00:00.000Z'),
    });

    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    const [to, subject, html, label, sender] = sendMailSpy.mock.calls[0];

    expect(to).toBe('user@example.com');
    expect(subject).toBe('New login to your Vizora account');
    expect(html).toContain('New login detected');
    expect(html).toContain('https://app.vizora.test/dashboard/settings');
    expect(html).toContain('Review Account');
    expect(label).toBe('Unrecognized login');
    expect(sender).toBe('auth');
  });

  it('escapes caller-supplied name, IP address, and user agent', async () => {
    await service.sendUnrecognizedLoginEmail('user@example.com', '<Ada>', {
      ipAddress: '203.0.113.10"><script>',
      userAgent: 'Browser <img src=x onerror=alert(1)>',
      occurredAt: new Date('2026-05-31T12:00:00.000Z'),
    });

    const [, , html] = sendMailSpy.mock.calls[0];

    expect(html).toContain('&lt;Ada&gt;');
    expect(html).toContain('203.0.113.10&quot;&gt;&lt;script&gt;');
    expect(html).toContain('Browser &lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<Ada>');
    expect(html).not.toContain('203.0.113.10"><script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});

describe('MailService customer-visible template escaping', () => {
  const originalEnv = process.env;
  let service: MailService;
  let sendMailSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_PASSWORD;
    delete process.env.EMAIL_FROM;
    service = new MailService();
    sendMailSpy = jest.spyOn(service as unknown as { sendMail: jest.Func }, 'sendMail').mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('escapes payment receipt plan, amount, and currency fields', async () => {
    await service.sendPaymentReceiptEmail(
      'billing@example.com',
      '<Ada>',
      '<Pro>',
      '<999>',
      'usd<script>',
    );

    const [, , html, label, sender] = sendMailSpy.mock.calls[0];

    expect(html).toContain('&lt;Ada&gt;');
    expect(html).toContain('&lt;Pro&gt;');
    expect(html).toContain('&lt;999&gt;');
    expect(html).toContain('USD&lt;SCRIPT&gt;');
    expect(html).not.toContain('<Ada>');
    expect(html).not.toContain('<Pro>');
    expect(html).not.toContain('<999>');
    expect(html).not.toContain('USD<SCRIPT>');
    expect(label).toBe('Payment receipt');
    expect(sender).toBe('billing');
  });

  it('escapes plan-change plan names', async () => {
    await service.sendPlanChangedEmail(
      'billing@example.com',
      '<Ada>',
      '<Free>',
      '<Pro>',
    );

    const [, , html, label, sender] = sendMailSpy.mock.calls[0];

    expect(html).toContain('&lt;Ada&gt;');
    expect(html).toContain('&lt;Free&gt;');
    expect(html).toContain('&lt;Pro&gt;');
    expect(html).not.toContain('<Ada>');
    expect(html).not.toContain('<Free>');
    expect(html).not.toContain('<Pro>');
    expect(label).toBe('Plan changed');
    expect(sender).toBe('billing');
  });

  it('escapes subscription cancellation access date', async () => {
    await service.sendSubscriptionCanceledEmail(
      'billing@example.com',
      '<Ada>',
      '<script>date</script>',
    );

    const [, , html, label, sender] = sendMailSpy.mock.calls[0];

    expect(html).toContain('&lt;Ada&gt;');
    expect(html).toContain('&lt;script&gt;date&lt;/script&gt;');
    expect(html).not.toContain('<Ada>');
    expect(html).not.toContain('<script>date</script>');
    expect(label).toBe('Subscription canceled');
    expect(sender).toBe('billing');
  });

  it('escapes CTA href attributes such as password reset URLs', async () => {
    process.env.SMTP_HOST = 'smtp.resend.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'resend';
    process.env.SMTP_PASS = 'resend-secret';
    service = new MailService();

    await service.sendPasswordResetEmail(
      'user@example.com',
      'Ada',
      'https://vizora.test/reset?token="bad"&next=<x>',
    );

    const transport = (nodemailer.createTransport as jest.Mock).mock.results.at(-1)?.value as {
      sendMail: jest.Mock;
    };
    const message = transport.sendMail.mock.calls[0][0];

    expect(message.html).toContain(
      'https://vizora.test/reset?token=&quot;bad&quot;&amp;next=&lt;x&gt;',
    );
    expect(message.html).not.toContain('token="bad"&next=<x>');
  });
});
