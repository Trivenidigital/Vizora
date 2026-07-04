import type { EffectiveContent, EffectivePlaylistItem } from './effective-content.js';

/**
 * The SINGLE wire serializer for device content (T2). BOTH the pull endpoint
 * (`GET /devices/me/content`, increment 3) and the realtime push
 * (`sendInitialState`, increment 4) serialize the resolver output through THIS
 * function, so push and pull are byte-identical at the wire — not merely agreeing at
 * the resolver. The device applies the payload via `shouldApplyContent`, keyed on the
 * `version` this serializer carries.
 *
 * NOTE (layouts / PD-9): metadata is redacted here, but layout ZONE content
 * (`metadata.zones[].contentId/playlistId`) is NOT resolved — that needs DB access and
 * is the PD-9 slice. Non-layout content is fully handled. Increment 4 must route
 * layout zone resolution through a shared step too, or push/pull diverge for layouts.
 */

type JsonRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is JsonRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Recursively strip `widgetConfig` from generic-api widgets (device never needs
 *  widget secrets). Structurally shared with realtime's redactDevicePayload. */
function redactWidgetSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const redacted = value.map((item) => {
      const next = redactWidgetSecrets(item);
      changed = changed || next !== item;
      return next;
    });
    return changed ? redacted : value;
  }
  if (!isRecord(value)) return value;

  let copy: JsonRecord | null = null;
  const mutableCopy = () => {
    copy ??= { ...value };
    return copy;
  };
  if (
    value.isWidget === true &&
    value.widgetType === 'generic-api' &&
    Object.prototype.hasOwnProperty.call(value, 'widgetConfig')
  ) {
    delete mutableCopy().widgetConfig;
  }
  const source = copy ?? value;
  for (const [key, child] of Object.entries(source)) {
    const redactedChild = redactWidgetSecrets(child);
    if (redactedChild !== child) mutableCopy()[key] = redactedChild;
  }
  return copy ?? value;
}

export interface DeviceContentItem {
  order: number;
  content: {
    id: string;
    name: string;
    type: string;
    url: string;
    thumbnail?: string | null;
    mimeType?: string | null;
    duration?: number | null;
    // PD-7 content-mutation discriminator + the version source. ISO string.
    updatedAt?: string | null;
    metadata?: unknown;
  } | null;
}

export interface DeviceContentPayload {
  source: EffectiveContent['source'];
  /** The idempotency stamp `shouldApplyContent` keys on. */
  version: string;
  playlist: { id: string; items: DeviceContentItem[] } | null;
}

const toIso = (v: Date | string | null | undefined): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

/** Resolve a stored content url to a device-fetchable url. `minio://` objects are
 *  served through the content API keyed on the content id (never a client value). */
function deviceContentUrl(content: JsonRecord, contentBaseUrl: string): string {
  const url = typeof content.url === 'string' ? content.url : '';
  if (url.startsWith('minio://')) {
    return `${contentBaseUrl}/api/v1/device-content/${String(content.id)}/file`;
  }
  return url;
}

/**
 * Serialize the resolver's EffectiveContent into the device wire payload. Pure — the
 * one app-specific input (the content base url) is a parameter, so both apps produce
 * identical bytes given identical resolver output + base url.
 */
export function serializeDeviceContent(
  effective: EffectiveContent,
  opts: { contentBaseUrl: string },
): DeviceContentPayload {
  const { playlist, source, version } = effective;
  if (!playlist) return { source, version, playlist: null };

  const items: DeviceContentItem[] = (playlist.items ?? []).map((item: EffectivePlaylistItem) => {
    const c = item.content as JsonRecord | null | undefined;
    return {
      order: item.order,
      content: c
        ? {
            id: String(c.id),
            name: String(c.name ?? ''),
            type: String(c.type ?? ''),
            url: deviceContentUrl(c, opts.contentBaseUrl),
            thumbnail: (c.thumbnail as string | null | undefined) ?? null,
            mimeType: (c.mimeType as string | null | undefined) ?? null,
            duration: (c.duration as number | null | undefined) ?? null,
            updatedAt: toIso(c.updatedAt as Date | string | null | undefined),
            metadata: redactWidgetSecrets(c.metadata),
          }
        : null,
    };
  });

  return { source, version, playlist: { id: playlist.id, items } };
}
