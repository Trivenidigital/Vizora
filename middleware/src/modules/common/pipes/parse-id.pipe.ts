import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Validates that a route parameter is a valid Prisma ID (UUID or CUID).
 *
 * Prisma uses cuid() by default for most models (Content, Playlist, Schedule,
 * DisplayGroup, etc.) and uuid() for a few (Organization, User, Display).
 * This pipe accepts both formats so controllers don't need to know which
 * ID strategy a model uses.
 *
 * UUID v4:  e.g. "550e8400-e29b-41d4-a716-446655440000"
 * CUID:     e.g. "clh2k3j4g0000qw08a1b2c3d4" (starts with 'c', 25+ chars)
 */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, string> {
  // UUID v1–v5 pattern (8-4-4-4-12 hex)
  private static readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // CUID pattern: starts with 'c', followed by lowercase alphanumeric, 20-30 chars total
  private static readonly CUID_RE = /^c[a-z0-9]{19,29}$/;

  transform(value: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException('ID parameter is required');
    }

    const trimmed = value.trim();

    if (ParseIdPipe.UUID_RE.test(trimmed) || ParseIdPipe.CUID_RE.test(trimmed)) {
      return trimmed;
    }

    throw new BadRequestException(
      'Validation failed (valid ID expected — UUID or CUID format)',
    );
  }
}
