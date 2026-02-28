#!/usr/bin/env npx tsx
/**
 * 02 — Content / Layout / Storage Validator
 *
 * Rules: C-001 to C-007, L-001 to L-003, ST-001 to ST-002
 *
 * Usage: npx tsx 02-content-validator.ts --base-url http://localhost:3000 --token JWT
 * Exit: 0 = no criticals, 1 = has criticals, 2 = error
 */

import {
  parseArgs, VizoraApiClient, outputJson, fail, makeResult,
  type ValidationIssue,
} from './lib.js';

interface ContentItem {
  id: string;
  name?: string;
  title?: string;
  type: string;
  mimeType?: string;
  url?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  status?: string;
  expiresAt?: string;
  duration?: number;
  fileSize?: number;
  metadata?: Record<string, unknown>;
  playlistIds?: string[];
}

interface Playlist {
  id: string;
  name?: string;
  items?: { contentId: string }[];
  _count?: { items: number };
}

interface StorageInfo {
  used?: number;
  limit?: number;
  percentage?: number;
}

async function main() {
  const args = parseArgs();
  if (!args.token) fail('--token is required for content validation');

  const api = new VizoraApiClient(args.baseUrl, args.token);
  const issues: ValidationIssue[] = [];
  const startTime = Date.now();

  // Fetch data
  const [content, playlists] = await Promise.all([
    api.getAll<ContentItem>('/content', {}, args.limit),
    api.getAll<Playlist>('/playlists', {}, args.limit),
  ]);

  const contentInPlaylists = new Set<string>();
  for (const pl of playlists) {
    if (pl.items) {
      for (const item of pl.items) {
        contentInPlaylists.add(item.contentId);
      }
    }
  }

  // ── Content Rules ────────────────────────────────────────────────────────

  for (const c of content) {
    const name = c.name || c.title || c.id;
    const contentUrl = c.url || c.fileUrl || '';

    // C-001: URL format validity
    if (contentUrl && !isValidContentUrl(contentUrl)) {
      issues.push({
        rule: 'C-001',
        severity: 'critical',
        entity: 'content',
        entityId: c.id,
        entityName: name,
        message: `Invalid content URL format: "${contentUrl.slice(0, 80)}"`,
        recommendation: 'Re-upload the content or fix the URL in the database.',
      });
    }

    // C-002: Expired but still active
    if (c.expiresAt && c.status === 'active') {
      const expiresAt = new Date(c.expiresAt);
      if (expiresAt < new Date()) {
        issues.push({
          rule: 'C-002',
          severity: 'warning',
          entity: 'content',
          entityId: c.id,
          entityName: name,
          message: `Content expired on ${expiresAt.toISOString()} but still active`,
          recommendation: 'Archive expired content or extend expiration date.',
        });
      }
    }

    // C-003: Orphaned content (not in any playlist)
    if (!contentInPlaylists.has(c.id) && c.type !== 'layout') {
      issues.push({
        rule: 'C-003',
        severity: 'info',
        entity: 'content',
        entityId: c.id,
        entityName: name,
        message: 'Content not assigned to any playlist',
        recommendation: 'Add to a playlist or archive if no longer needed.',
      });
    }

    // C-004: Missing thumbnail for image/video
    if ((c.type === 'image' || c.type === 'video') && !c.thumbnailUrl) {
      issues.push({
        rule: 'C-004',
        severity: 'info',
        entity: 'content',
        entityId: c.id,
        entityName: name,
        message: `${c.type} content has no thumbnail`,
        recommendation: 'Re-upload or trigger thumbnail generation.',
      });
    }

    // C-005: Type vs mimeType mismatch
    if (c.mimeType && c.type) {
      const mismatch = checkTypeMismatch(c.type, c.mimeType);
      if (mismatch) {
        issues.push({
          rule: 'C-005',
          severity: 'warning',
          entity: 'content',
          entityId: c.id,
          entityName: name,
          message: `Content type "${c.type}" doesn't match MIME "${c.mimeType}"`,
          recommendation: 'Update the content type or re-upload with correct format.',
        });
      }
    }

    // C-006: Zero duration
    if (c.duration !== undefined && c.duration <= 0 && c.type !== 'url') {
      issues.push({
        rule: 'C-006',
        severity: 'warning',
        entity: 'content',
        entityId: c.id,
        entityName: name,
        message: 'Content has zero or negative duration — will flash or be skipped',
        recommendation: 'Set a valid display duration (minimum 1 second).',
      });
    }

    // C-007: Large file warnings
    if (c.fileSize) {
      const mb = c.fileSize / (1024 * 1024);
      if (c.type === 'image' && mb > 10) {
        issues.push({
          rule: 'C-007',
          severity: 'warning',
          entity: 'content',
          entityId: c.id,
          entityName: name,
          message: `Image is ${mb.toFixed(1)}MB (>10MB) — may cause slow loading on displays`,
          recommendation: 'Compress the image or convert to a more efficient format.',
        });
      } else if (c.type === 'video' && mb > 100) {
        issues.push({
          rule: 'C-007',
          severity: 'warning',
          entity: 'content',
          entityId: c.id,
          entityName: name,
          message: `Video is ${mb.toFixed(1)}MB (>100MB) — may cause buffering on displays`,
          recommendation: 'Transcode to a lower bitrate or resolution.',
        });
      }
    }
  }

  // ── Layout Rules ─────────────────────────────────────────────────────────

  const layouts = content.filter((c) => c.type === 'layout');
  for (const layout of layouts) {
    const name = layout.name || layout.title || layout.id;

    // Try to get resolved layout data
    try {
      const resolved = await api.get<Record<string, unknown>>(
        `/content/layouts/${layout.id}/resolved`,
      );
      const zones = (resolved?.zones ?? resolved?.regions ?? []) as Array<Record<string, unknown>>;

      if (Array.isArray(zones)) {
        let emptyZoneCount = 0;

        for (const zone of zones) {
          const zoneName = (zone.name || zone.id || 'unknown') as string;
          const hasContent = zone.contentId || zone.playlistId || zone.widgetType;

          // L-001: Zone with no content assigned
          if (!hasContent) {
            emptyZoneCount++;
            issues.push({
              rule: 'L-001',
              severity: 'critical',
              entity: 'layout-zone',
              entityId: layout.id,
              entityName: `${name} → ${zoneName}`,
              message: `Layout zone "${zoneName}" has no content, playlist, or widget assigned`,
              recommendation: 'Assign content to this zone or remove it from the layout.',
            });
          }

          // L-002: Zone references nonexistent content
          if (zone.contentId && zone.resolveError) {
            issues.push({
              rule: 'L-002',
              severity: 'critical',
              entity: 'layout-zone',
              entityId: layout.id,
              entityName: `${name} → ${zoneName}`,
              message: `Zone references content that no longer exists`,
              recommendation: 'Update the zone to reference valid content.',
            });
          }
        }

        // L-003: All zones empty
        if (zones.length > 0 && emptyZoneCount === zones.length) {
          issues.push({
            rule: 'L-003',
            severity: 'critical',
            entity: 'layout',
            entityId: layout.id,
            entityName: name,
            message: 'All zones in layout are empty — display will show nothing',
            recommendation: 'Assign content to at least one zone.',
          });
        }
      }
    } catch {
      // Layout resolve endpoint may not exist — skip layout-specific checks
    }
  }

  // ── Storage Rules ────────────────────────────────────────────────────────

  try {
    const storage = await api.get<StorageInfo>('/organizations/storage');
    const pct = storage?.percentage ?? (storage?.limit ? ((storage.used ?? 0) / storage.limit) * 100 : 0);

    if (pct > 100) {
      issues.push({
        rule: 'ST-002',
        severity: 'critical',
        entity: 'storage',
        entityId: 'org',
        entityName: 'Organization storage',
        message: `Storage quota exceeded: ${pct.toFixed(1)}% used`,
        recommendation: 'Delete unused content or increase storage quota.',
      });
    } else if (pct > 80) {
      issues.push({
        rule: 'ST-001',
        severity: 'warning',
        entity: 'storage',
        entityId: 'org',
        entityName: 'Organization storage',
        message: `Storage at ${pct.toFixed(1)}% capacity`,
        recommendation: 'Consider archiving old content to free space.',
      });
    }
  } catch {
    // Storage endpoint may not exist — skip
  }

  // ── Output ───────────────────────────────────────────────────────────────

  const result = makeResult('content', issues, {
    totalContent: content.length,
    totalPlaylists: playlists.length,
    totalLayouts: layouts.length,
    orphanedContent: issues.filter((i) => i.rule === 'C-003').length,
  }, startTime);

  outputJson(result);
  const hasCritical = issues.some((i) => i.severity === 'critical');
  process.exit(hasCritical ? 1 : 0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidContentUrl(url: string): boolean {
  if (url.startsWith('minio://')) return true;
  if (url.startsWith('/uploads/')) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function checkTypeMismatch(type: string, mime: string): boolean {
  const mimeMap: Record<string, string[]> = {
    image: ['image/'],
    video: ['video/'],
    html: ['text/html', 'application/xhtml'],
  };
  const expected = mimeMap[type];
  if (!expected) return false;
  return !expected.some((prefix) => mime.startsWith(prefix));
}

main().catch((err) => fail(err.message));
