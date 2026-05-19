import { validate } from 'class-validator';
import { CreateRecipientDto } from './create-recipient.dto';

/**
 * Tests for the IsValidRecipientTarget custom validator (via the DTO that
 * uses it). The stacked-@ValidateIf pattern was broken before; this verifies
 * each channel's target gets the right validation.
 */
describe('IsValidRecipientTarget (via CreateRecipientDto)', () => {
  async function validateDto(channel: string, target: string) {
    const dto = new CreateRecipientDto();
    (dto as any).channel = channel;
    dto.target = target;
    return validate(dto);
  }

  describe('in_app channel', () => {
    it('accepts any non-empty string (cross-tenant guard is at the service layer)', async () => {
      const errors = await validateDto('in_app', 'user-cuid-123');
      expect(errors).toHaveLength(0);
    });

    it('rejects empty string', async () => {
      const errors = await validateDto('in_app', '');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('email channel', () => {
    it('accepts a valid email address', async () => {
      const errors = await validateDto('email', 'ops@example.com');
      expect(errors).toHaveLength(0);
    });

    it('rejects a non-email string (e.g. a userId)', async () => {
      const errors = await validateDto('email', 'user-cuid-123');
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('email target');
    });

    it('rejects an email with CRLF injection attempt', async () => {
      const errors = await validateDto('email', 'a@b.com\r\nBcc: attacker@evil.com');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects a Slack webhook URL pasted into the email channel', async () => {
      const errors = await validateDto('email', 'https://hooks.slack.com/services/T/B/x');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('slack_webhook channel', () => {
    it('accepts a https://hooks.slack.com/services/... URL', async () => {
      const errors = await validateDto('slack_webhook', 'https://hooks.slack.com/services/TABC/BDEF/xyz123');
      expect(errors).toHaveLength(0);
    });

    it('rejects a different host (PagerDuty / Discord — must come in a follow-up)', async () => {
      const errors = await validateDto('slack_webhook', 'https://events.pagerduty.com/v2/enqueue');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects http:// (would allow SSRF chains)', async () => {
      const errors = await validateDto('slack_webhook', 'http://hooks.slack.com/services/T/B/x');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects an email pasted into the slack_webhook channel', async () => {
      const errors = await validateDto('slack_webhook', 'ops@example.com');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects an internal URL (SSRF defense at the DTO layer)', async () => {
      const errors = await validateDto('slack_webhook', 'https://internal-metadata.example/secret');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('rejects unknown channel', async () => {
    const errors = await validateDto('mystery-channel', 'whatever');
    expect(errors.length).toBeGreaterThan(0);
  });
});
