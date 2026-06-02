import { BadRequestException } from '@nestjs/common';

export const MINIO_URL_PREFIX = 'minio://';

export function isMinioUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(MINIO_URL_PREFIX);
}

export function assertOrgOwnedMinioObjectKey(
  organizationId: string,
  objectKey: string,
): void {
  if (!objectKey.startsWith(`${organizationId}/`)) {
    throw new BadRequestException('Content file is not owned by this organization');
  }
}

export function getOwnedMinioObjectKey(
  organizationId: string,
  url: unknown,
): string | null {
  if (!isMinioUrl(url)) {
    return null;
  }

  const objectKey = url.substring(MINIO_URL_PREFIX.length);
  assertOrgOwnedMinioObjectKey(organizationId, objectKey);
  return objectKey;
}

export function getCleanupSafeMinioObjectKey(
  organizationId: string,
  url: unknown,
): string | null {
  if (!isMinioUrl(url)) {
    return null;
  }

  const objectKey = url.substring(MINIO_URL_PREFIX.length);
  return objectKey.startsWith(`${organizationId}/`) ? objectKey : null;
}
