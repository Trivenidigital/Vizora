import { serializeDeviceContent } from '../src/lib/device-content-payload';
import { EffectiveContent } from '../src/lib/effective-content';

const base = 'https://api.example.com';
const eff = (playlist: any, version = 'v1'): EffectiveContent => ({
  playlist,
  source: 'currentPlaylist',
  scheduleId: null,
  version,
});

describe('serializeDeviceContent — the single wire serializer (push == pull)', () => {
  it('transforms minio:// urls to the device-content API url (keyed on content id, not client value)', () => {
    const out = serializeDeviceContent(
      eff({ id: 'pl-1', items: [{ order: 0, content: { id: 'c1', name: 'a', type: 'image', url: 'minio://bucket/x' } }] }),
      { contentBaseUrl: base },
    );
    expect(out.playlist?.items[0].content?.url).toBe(`${base}/api/v1/device-content/c1/file`);
  });

  it('passes non-minio urls through unchanged', () => {
    const out = serializeDeviceContent(
      eff({ id: 'pl-1', items: [{ order: 0, content: { id: 'c1', name: 'a', type: 'url', url: 'https://x.test/v' } }] }),
      { contentBaseUrl: base },
    );
    expect(out.playlist?.items[0].content?.url).toBe('https://x.test/v');
  });

  it('serializes content.updatedAt to an ISO string (the version discriminator the client keys on)', () => {
    const out = serializeDeviceContent(
      eff({ id: 'pl-1', items: [{ order: 0, content: { id: 'c1', name: 'a', type: 'image', url: '', updatedAt: new Date('2026-03-01T00:00:00Z') } }] }),
      { contentBaseUrl: base },
    );
    expect(out.playlist?.items[0].content?.updatedAt).toBe('2026-03-01T00:00:00.000Z');
  });

  it('redacts generic-api widget secrets from metadata (device never receives widgetConfig)', () => {
    const out = serializeDeviceContent(
      eff({
        id: 'pl-1',
        items: [{ order: 0, content: { id: 'c1', name: 'a', type: 'widget', url: '', metadata: { isWidget: true, widgetType: 'generic-api', widgetConfig: { apiKey: 'SECRET' } } } }],
      }),
      { contentBaseUrl: base },
    );
    const meta = out.playlist?.items[0].content?.metadata as any;
    expect(meta.widgetConfig).toBeUndefined();
    expect(meta.isWidget).toBe(true);
  });

  it('carries the resolver version through, and returns null playlist for source none', () => {
    expect(serializeDeviceContent(eff({ id: 'pl-1', items: [] }, 'V9'), { contentBaseUrl: base }).version).toBe('V9');
    const none = serializeDeviceContent({ playlist: null, source: 'none', scheduleId: null, version: '' }, { contentBaseUrl: base });
    expect(none.playlist).toBeNull();
    expect(none.source).toBe('none');
  });
});
