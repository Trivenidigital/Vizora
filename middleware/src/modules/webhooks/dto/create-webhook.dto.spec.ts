import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateWebhookDto } from './create-webhook.dto';

/**
 * DTO-level validation tests. These exercise the class-validator
 * decorators directly so the regression coverage doesn't depend on
 * the full controller test path running ValidationPipe.
 */
describe('CreateWebhookDto secret entropy', () => {
  const baseValid = {
    name: 'Test webhook',
    url: 'https://hooks.example.com/incoming',
    events: ['content.created'],
  };

  async function expectSecretAccepted(secret: string) {
    const dto = plainToInstance(CreateWebhookDto, { ...baseValid, secret });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'secret')).toHaveLength(0);
  }

  async function expectSecretRejected(secret: string, reasonHint: RegExp) {
    const dto = plainToInstance(CreateWebhookDto, { ...baseValid, secret });
    const errors = await validate(dto);
    const secretErrors = errors.filter((e) => e.property === 'secret');
    expect(secretErrors.length).toBeGreaterThan(0);
    const messages = Object.values(secretErrors[0].constraints ?? {}).join(' ');
    expect(messages).toMatch(reasonHint);
  }

  it('accepts a mixed-case secret with at least one digit (16+ chars)', async () => {
    await expectSecretAccepted('Abcdefgh12345678');
  });

  it('accepts a mixed-case secret with a special character', async () => {
    await expectSecretAccepted('Abcdefghijklmnop!');
  });

  it('REJECTS a 32-char all-lowercase secret (defends against dictionary phrases)', async () => {
    // Regression: the previous shape accepted this because it passed
    // the 16-char length gate alone. New regex requires entropy.
    await expectSecretRejected('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', /lowercase|uppercase|digit|special/i);
  });

  it('REJECTS the common "passwordpasswordpass" dictionary phrase', async () => {
    await expectSecretRejected('passwordpasswordpass', /lowercase|uppercase|digit|special/i);
  });

  it('REJECTS a secret with mixed case but no digit and no special', async () => {
    await expectSecretRejected('AbcdefghIjklmnop', /digit|special/i);
  });

  it('REJECTS a secret shorter than 16 characters even if entropy is high', async () => {
    await expectSecretRejected('Abc1!', /16/);
  });
});
