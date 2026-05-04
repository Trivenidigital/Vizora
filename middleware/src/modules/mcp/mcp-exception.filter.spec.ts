import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { McpExceptionFilter } from './mcp-exception.filter';

function makeHost(preexistingHeaders: Record<string, string | number> = {}): {
  filter: McpExceptionFilter;
  res: { statusCode: number | null; body: unknown; headers: Record<string, string | number> };
  host: Parameters<McpExceptionFilter['catch']>[1];
} {
  const recorded: { statusCode: number | null; body: unknown; headers: Record<string, string | number> } = {
    statusCode: null,
    body: null,
    headers: { ...preexistingHeaders },
  };
  const res = {
    status(code: number) { recorded.statusCode = code; return this; },
    json(body: unknown) { recorded.body = body; return this; },
    setHeader(key: string, value: string | number) { recorded.headers[key] = value; },
    getHeader(key: string) { return recorded.headers[key]; },
  };
  const req = { method: 'POST', originalUrl: '/api/v1/mcp', url: '/api/v1/mcp' };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as Parameters<McpExceptionFilter['catch']>[1];
  return { filter: new McpExceptionFilter(), res: recorded, host };
}

describe('McpExceptionFilter', () => {
  it.each<[Error, number, string]>([
    [new UnauthorizedException(),   HttpStatus.UNAUTHORIZED,         'UNAUTHORIZED'],
    [new ForbiddenException(),      HttpStatus.FORBIDDEN,            'FORBIDDEN'],
    [new NotFoundException('x'),    HttpStatus.NOT_FOUND,            'NOT_FOUND'],
    [new BadRequestException('x'),  HttpStatus.BAD_REQUEST,          'INVALID_INPUT'],
    [new ThrottlerException('x'),   HttpStatus.TOO_MANY_REQUESTS,    'RATE_LIMITED'],
    [new InternalServerErrorException('boom'), HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL'],
    [new Error('plain'),            HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL'],
  ])('maps %s → HTTP %d / code %s, body shape { error: { code, message } }', (err, status, code) => {
    const { filter, res, host } = makeHost();
    filter.catch(err, host);
    expect(res.statusCode).toBe(status);
    expect(res.body).toMatchObject({
      error: { code, message: expect.any(String) },
    });
    // Critical: response is NOT wrapped in NestJS's { statusCode, message, error }
    // envelope. The top-level shape is the MCP error contract.
    expect(res.body).not.toHaveProperty('statusCode');
  });

  it('sets Retry-After=60 on RATE_LIMITED when no upstream value is present', () => {
    const { filter, res, host } = makeHost();
    filter.catch(new ThrottlerException('too many'), host);
    expect(res.headers['Retry-After']).toBe('60');
  });

  it('PRESERVES an existing Retry-After header (e.g. from ThrottlerGuard) instead of overwriting with 60 — REGRESSION: previously clobbered the throttler-set TTL', () => {
    const { filter, res, host } = makeHost({ 'Retry-After': '7' });
    filter.catch(new ThrottlerException('too many'), host);
    expect(res.headers['Retry-After']).toBe('7');
  });

  it('does NOT leak the underlying error message for INTERNAL', () => {
    const { filter, res, host } = makeHost();
    filter.catch(new InternalServerErrorException('database connection refused at line 47'), host);
    const body = res.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL');
    expect(body.error.message).toBe('Internal server error');
    expect(body.error.message).not.toContain('database');
  });
});
