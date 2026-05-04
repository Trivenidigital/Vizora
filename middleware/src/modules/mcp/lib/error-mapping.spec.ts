import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { mapExceptionToMcpError } from './error-mapping';

describe('mapExceptionToMcpError', () => {
  it('maps NotFoundException → NOT_FOUND (not INVALID_INPUT — the retry-loop hazard)', () => {
    const r = mapExceptionToMcpError(new NotFoundException('display abc not found'));
    expect(r.code).toBe('NOT_FOUND');
    expect(r.message).toContain('display abc not found');
  });

  it('maps BadRequestException → INVALID_INPUT', () => {
    const r = mapExceptionToMcpError(new BadRequestException('bad'));
    expect(r.code).toBe('INVALID_INPUT');
  });

  it('maps UnauthorizedException → UNAUTHORIZED', () => {
    const r = mapExceptionToMcpError(new UnauthorizedException());
    expect(r.code).toBe('UNAUTHORIZED');
  });

  it('maps ForbiddenException → FORBIDDEN', () => {
    const r = mapExceptionToMcpError(new ForbiddenException());
    expect(r.code).toBe('FORBIDDEN');
  });

  it('maps ThrottlerException → RATE_LIMITED', () => {
    const r = mapExceptionToMcpError(new ThrottlerException('too many'));
    expect(r.code).toBe('RATE_LIMITED');
  });

  it('maps unknown 4xx HttpException → INVALID_INPUT', () => {
    const r = mapExceptionToMcpError(
      new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT),
    );
    expect(r.code).toBe('INVALID_INPUT');
  });

  it('maps 5xx HttpException → INTERNAL with generic message (no leak)', () => {
    const r = mapExceptionToMcpError(
      new InternalServerErrorException('database panic at line 47'),
    );
    expect(r.code).toBe('INTERNAL');
    expect(r.message).toBe('Internal server error');
    expect(r.message).not.toContain('database panic');
  });

  it('maps a plain Error → INTERNAL with generic message', () => {
    const r = mapExceptionToMcpError(new Error('boom'));
    expect(r.code).toBe('INTERNAL');
    expect(r.message).toBe('Internal server error');
  });

  it('maps a non-error value → INTERNAL', () => {
    expect(mapExceptionToMcpError('string').code).toBe('INTERNAL');
    expect(mapExceptionToMcpError(null).code).toBe('INTERNAL');
    expect(mapExceptionToMcpError(undefined).code).toBe('INTERNAL');
  });
});
