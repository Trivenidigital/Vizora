import { Prisma } from '@vizora/database';

export const CONTENT_LIST_TYPES = [
  'image',
  'video',
  'url',
  'html',
  'pdf',
  'template',
  'layout',
  'widget',
] as const;

export const CONTENT_LIST_STATUSES = [
  'active',
  'archived',
  'draft',
  'flagged',
  'rejected',
  'pending_approval',
  'expired',
  'ready',
  'processing',
  'error',
] as const;

export const CONTENT_TEMPLATE_ORIENTATIONS = ['landscape', 'portrait', 'both'] as const;
export const CONTENT_DATE_RANGES = ['7days', '30days', '90days'] as const;

export type ContentDateRange = typeof CONTENT_DATE_RANGES[number];

export interface ContentListFilters {
  type?: string;
  status?: string;
  templateOrientation?: string;
  search?: string;
  dateRange?: ContentDateRange;
  tagNames?: string[];
  tagIds?: string[];
  folderId?: string;
}

const DATE_RANGE_DAYS: Record<ContentDateRange, number> = {
  '7days': 7,
  '30days': 30,
  '90days': 90,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function hasValue<T extends readonly string[]>(values: T, value: string | undefined): value is T[number] {
  return Boolean(value && values.includes(value as T[number]));
}

function normalizeTagNames(tagNames: string[] | undefined): string[] {
  if (!tagNames) return [];
  return Array.from(new Set(
    tagNames
      .map((tagName) => tagName.trim())
      .filter(Boolean),
  ));
}

function normalizeTagIds(tagIds: string[] | undefined): string[] {
  if (!tagIds) return [];
  return Array.from(new Set(
    tagIds
      .map((tagId) => tagId.trim())
      .filter(Boolean),
  ));
}

export function buildContentListWhere(
  organizationId: string,
  filters: ContentListFilters = {},
): Prisma.ContentWhereInput {
  const where: Prisma.ContentWhereInput = { organizationId };
  const andFilters: Prisma.ContentWhereInput[] = [];

  if (filters.folderId) {
    where.folderId = filters.folderId;
  }

  if (hasValue(CONTENT_LIST_TYPES, filters.type)) {
    where.type = filters.type;
  }

  if (hasValue(CONTENT_LIST_STATUSES, filters.status)) {
    where.status = filters.status;
  }

  if (hasValue(CONTENT_TEMPLATE_ORIENTATIONS, filters.templateOrientation)) {
    where.templateOrientation = filters.templateOrientation;
  }

  const search = filters.search?.trim();
  if (search) {
    andFilters.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (filters.dateRange && filters.dateRange in DATE_RANGE_DAYS) {
    where.createdAt = {
      gte: new Date(Date.now() - DATE_RANGE_DAYS[filters.dateRange] * DAY_MS),
    };
  }

  const tagNames = normalizeTagNames(filters.tagNames);
  if (tagNames.length > 0) {
    andFilters.push({
      OR: tagNames.flatMap((tagName) => [
        {
          tags: {
            some: {
              tag: {
                organizationId,
                name: { equals: tagName, mode: 'insensitive' },
              },
            },
          },
        },
        {
          metadata: {
            path: ['tags'],
            array_contains: tagName,
          },
        },
      ]),
    });
  }

  const tagIds = normalizeTagIds(filters.tagIds);
  if (tagIds.length > 0) {
    andFilters.push({
      tags: {
        some: {
          tag: {
            organizationId,
            id: { in: tagIds },
          },
        },
      },
    });
  }

  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  return where;
}
