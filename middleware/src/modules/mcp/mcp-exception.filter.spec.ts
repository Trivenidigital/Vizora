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

function makeHost(): {
  filter: McpExceptionFilter;
  res: { statusCode: number | null; body: unknown; headers: Record<string, string> };
  host: Parameters<McpExceptionFilter['catch']>[1];
} {
  const recorded: { statusCode: number | null; body: unknown; headers: Record<string, string> } = {
    statusCode: null,
    body: null,
    headers: {},
  };
  const res = {
    status(code: number) { recorded.statusCode = code; return this; },
    json(body: unknown) { recorded.body = body; return this; },
    setHeader(key: string, value: string) { recorded.headers[key] = value; },
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

  it('sets Retry-After header on RATE_LIMITED responses', () => {
    const { filter, res, host } = makeHost();
    filter.catch(new ThrottlerException('too many'), host);
    expect(res.headers['Retry-After']).toBe('60');
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
