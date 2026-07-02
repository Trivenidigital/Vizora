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

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SMTP_PASSWORD;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('accepts SMTP_PASS as the documented password alias', () => {
    process.env.SMTP_HOST = 'smtp.resend.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'resend';
    process.env.SMTP_PASS = 'resend-secret';

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

describe('MailService critical email (B7) — sandbox-intercepted smoke', () => {
  const originalEnv = process.env;
  let sentMailMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Sandbox transport: intercepts sends instead of hitting a real SMTP server.
    sentMailMock = jest.fn().mockResolvedValue({ messageId: 'sandbox-1' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sentMailMock });
    process.env.SMTP_HOST = 'sandbox.smtp';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASSWORD = 'p';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('password reset: dispatches an email carrying the reset URL', async () => {
    const service = new MailService();
    await service.sendPasswordResetEmail('locked@example.com', 'Ada', 'https://app/reset?token=abc');

    expect(sentMailMock).toHaveBeenCalledTimes(1);
    const arg = sentMailMock.mock.calls[0][0];
    expect(arg.to).toBe('locked@example.com');
    expect(arg.subject).toBe('Reset your Vizora password');
    expect(arg.html).toContain('https://app/reset?token=abc');
  });

  it('invoice/receipt: dispatches a billing email', async () => {
    const service = new MailService();
    // sendPaymentReceiptEmail(to, firstName, planName, amount, currency)
    await service.sendPaymentReceiptEmail('cust@example.com', 'Ada', 'Pro', '29.00', 'usd');
    expect(sentMailMock).toHaveBeenCalledTimes(1);
    expect(sentMailMock.mock.calls[0][0].to).toBe('cust@example.com');
  });

  it('CRITICAL fail-loud: password reset THROWS in production when SMTP is unconfigured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    (nodemailer.createTransport as jest.Mock).mockReturnValue(null);

    const service = new MailService();
    await expect(
      service.sendPasswordResetEmail('locked@example.com', 'Ada', 'https://app/reset?token=abc'),
    ).rejects.toThrow(/SMTP not configured|unavailable/i);
  });

  it('non-critical email does NOT throw when SMTP is unconfigured (welcome swallows)', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    (nodemailer.createTransport as jest.Mock).mockReturnValue(null);

    const service = new MailService();
    // Welcome is best-effort — a dead mailer must not break registration.
    await expect(
      service.sendWelcomeEmail('new@example.com', 'Ada'),
    ).resolves.not.toThrow();
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
