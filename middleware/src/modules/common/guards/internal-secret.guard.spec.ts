import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { InternalSecretGuard } from './internal-secret.guard';

describe('InternalSecretGuard', () => {
  let guard: InternalSecretGuard;
  const SECRET = 'test-secret-1234';

  function makeCtx(headers: Record<string, string | undefined>): ExecutionContext {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (v !== undefined) cleaned[k] = v;
    }
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: cleaned }),
      }),
    } as unknown as ExecutionContext;
  }

  async function makeGuard(secret: string | undefined): Promise<InternalSecretGuard> {
    const mod = await Test.createTestingModule({
      providers: [
        InternalSecretGuard,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => secret) },
        },
      ],
    }).compile();
    return mod.get(InternalSecretGuard);
  }

  beforeEach(async () => {
    guard = await makeGuard(SECRET);
  });

  it('allows when both headers are correct', () => {
    expect(
      guard.canActivate(
        makeCtx({ 'x-internal-api-key': SECRET, 'x-internal-caller': 'runner' }),
      ),
    ).toBe(true);
  });

  it('accepts each allowed caller value (runner, sidecar, ops)', () => {
    for (const caller of ['runner', 'sidecar', 'ops']) {
      expect(
        guard.canActivate(
          makeCtx({ 'x-internal-api-key': SECRET, 'x-internal-caller': caller }),
        ),
      ).toBe(true);
    }
  });

  it('rejects with 401 when api-key header is missing', () => {
    expect(() => guard.canActivate(makeCtx({ 'x-internal-caller': 'runner' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects with 401 when api-key header is wrong', () => {
    expect(() =>
      guard.canActivate(
        makeCtx({ 'x-internal-api-key': 'wrong-secret', 'x-internal-caller': 'runner' }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects with 401 when api-key header is correct length but wrong content (constant-time)', () => {
    // Same length as SECRET but every char flipped.
    const wrong = 'X'.repeat(SECRET.length);
    expect(() =>
      guard.canActivate(
        makeCtx({ 'x-internal-api-key': wrong, 'x-internal-caller': 'runner' }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects with 401 when caller header is missing', () => {
    expect(() =>
      guard.canActivate(makeCtx({ 'x-internal-api-key': SECRET })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects with 401 when caller header is unknown', () => {
    expect(() =>
      guard.canActivate(
        makeCtx({ 'x-internal-api-key': SECRET, 'x-internal-caller': 'unknown-caller' }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects with 401 when INTERNAL_API_SECRET env not set (fail-closed)', async () => {
    const g = await makeGuard(undefined);
    expect(() =>
      g.canActivate(makeCtx({ 'x-internal-api-key': SECRET, 'x-internal-caller': 'runner' })),
    ).toThrow(UnauthorizedException);
  });

  it('stamps the validated caller onto the request object', () => {
    const req: { headers: Record<string, string>; internalCaller?: string } = {
      headers: { 'x-internal-api-key': SECRET, 'x-internal-caller': 'sidecar' },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.internalCaller).toBe('sidecar');
  });
});
