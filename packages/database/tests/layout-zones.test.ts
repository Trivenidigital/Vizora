import { resolveEffectiveContent, contentVersion } from '../src/lib/effective-content';
import { serializeDeviceContent } from '../src/lib/device-content-payload';

// PD-9: layout zone resolution must live in the SHARED path (resolver + serializer
// both channels call) so push and pull are identical for layouts, and a single-zone
// content edit must propagate via the version.

const layoutContent = (zones: any[], updatedAt = '2026-01-01') => ({
  id: 'layout-1',
  type: 'layout',
  url: '',
  updatedAt: new Date(updatedAt),
  metadata: { zones },
});

describe('PD-9 — layout zone resolution in the shared resolver', () => {
  it('resolves each zone playlist + content ORG-SCOPED and inlines them', async () => {
    const zoneContent = { id: 'zc', name: 'Weather', type: 'url', url: 'https://x/w', updatedAt: new Date('2026-01-03') };
    const zonePlaylist = { id: 'zp', name: 'ZP', updatedAt: new Date('2026-01-04'), items: [] };
    const db = {
      display: { findFirst: async () => ({ timezone: 'UTC', isDisabled: false, currentPlaylistId: 'pl-1' }) },
      schedule: { findMany: async () => [] },
      playlist: {
        findFirst: async (args: any) =>
          args.where.id === 'pl-1'
            ? { id: 'pl-1', name: 'PL', updatedAt: new Date('2026-01-01'), items: [{ contentId: 'layout-1', order: 0, content: layoutContent([{ id: 'z1', playlistId: 'zp' }, { id: 'z2', contentId: 'zc' }]) }] }
            : args.where.id === 'zp'
              ? zonePlaylist
              : null,
      },
      content: { findFirst: async (args: any) => (args.where.id === 'zc' ? zoneContent : null) },
    };

    const eff = await resolveEffectiveContent(db as any, 'd', 'org', new Date('2026-06-01T12:00:00Z'));
    const zones = (eff.playlist!.items![0].content as any).metadata.zones;
    expect(zones[0].resolvedPlaylist.id).toBe('zp');
    expect(zones[1].resolvedContent.id).toBe('zc');
  });

  it('a cross-org zone id resolves to null (org filter — no cross-tenant zone content)', async () => {
    const db = {
      display: { findFirst: async () => ({ timezone: 'UTC', isDisabled: false, currentPlaylistId: 'pl-1' }) },
      schedule: { findMany: async () => [] },
      playlist: {
        findFirst: async (args: any) =>
          args.where.id === 'pl-1'
            ? { id: 'pl-1', name: 'PL', updatedAt: new Date('2026-01-01'), items: [{ contentId: 'layout-1', order: 0, content: layoutContent([{ id: 'z', contentId: 'foreign' }]) }] }
            : null, // foreign zone playlist not in org
      },
      content: { findFirst: async () => null }, // foreign zone content not in org → null
    };
    const eff = await resolveEffectiveContent(db as any, 'd', 'org', new Date('2026-06-01T12:00:00Z'));
    expect((eff.playlist!.items![0].content as any).metadata.zones[0].resolvedContent).toBeNull();
  });
});

describe('PD-9 — per-zone version propagation (contentVersion descends into zones)', () => {
  const layoutPlaylist = (zoneUpdatedAt: string) => ({
    id: 'pl',
    updatedAt: new Date('2026-01-01'),
    items: [{ contentId: 'layout-1', order: 0, updatedAt: new Date('2026-01-01'), content: layoutContent([{ id: 'z', contentId: 'zc', resolvedContent: { id: 'zc', updatedAt: new Date(zoneUpdatedAt) } }]) }],
  });

  it('a single-zone content edit raises the version (would not, under content.updatedAt alone)', () => {
    const before = contentVersion(layoutPlaylist('2026-01-02') as any, null);
    const after = contentVersion(layoutPlaylist('2026-06-02') as any, null);
    expect(after > before).toBe(true);
  });

  it('descends into zone-playlist item content too', () => {
    const withZonePlaylist = (u: string) => ({
      id: 'pl', updatedAt: new Date('2026-01-01'),
      items: [{ contentId: 'layout-1', order: 0, content: layoutContent([{ id: 'z', playlistId: 'zp', resolvedPlaylist: { id: 'zp', items: [{ content: { id: 'zpc', updatedAt: new Date(u) } }] } }]) }],
    });
    expect(contentVersion(withZonePlaylist('2026-08-01') as any, null) > contentVersion(withZonePlaylist('2026-02-01') as any, null)).toBe(true);
  });
});

describe('PD-9 — serializer transforms zone urls + push==pull for layouts', () => {
  const effLayout = () => ({
    source: 'currentPlaylist' as const,
    version: 'v',
    scheduleId: null,
    playlist: {
      id: 'pl', name: 'PL',
      items: [{ order: 0, content: layoutContent([
        { id: 'z1', resolvedContent: { id: 'zc', url: 'minio://z/zc.png', isWidget: true, widgetType: 'generic-api', widgetConfig: { apiKey: 'SECRET' } } },
        { id: 'z2', resolvedPlaylist: { id: 'zp', items: [{ content: { id: 'zpc', url: 'minio://z/zpc.png' } }] } },
      ]) }],
    },
  });

  it('is byte-identical across channels (both call the one serializer) and transforms zone minio urls', () => {
    const pull = serializeDeviceContent(effLayout() as any, { contentBaseUrl: 'https://api.test' });
    const push = serializeDeviceContent(effLayout() as any, { contentBaseUrl: 'https://api.test' });
    expect(push).toEqual(pull); // the coherence guarantee for layouts

    const zones = (push.playlist!.items[0].content!.metadata as any).zones;
    expect(zones[0].resolvedContent.url).toBe('https://api.test/api/v1/device-content/zc/file');
    expect(zones[1].resolvedPlaylist.items[0].content.url).toBe('https://api.test/api/v1/device-content/zpc/file');
  });

  it('redacts widget secrets inside zone content too', () => {
    const out = serializeDeviceContent(effLayout() as any, { contentBaseUrl: 'https://api.test' });
    expect(JSON.stringify(out)).not.toContain('SECRET');
  });
});
