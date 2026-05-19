import { MailService } from './mail.service';

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
