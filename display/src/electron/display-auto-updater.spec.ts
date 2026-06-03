import {
  normalizeDisplayUpdateFeedUrl,
  triggerDisplayAutoUpdate,
  type AutoUpdaterLike,
} from './display-auto-updater';

describe('display auto updater helper', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  const createUpdater = () => {
    const listeners = new Map<string, () => void>();
    const updater: jest.Mocked<AutoUpdaterLike> = {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      setFeedURL: jest.fn(),
      checkForUpdates: jest.fn().mockResolvedValue(null),
      on: jest.fn((event: string, listener: () => void) => {
        listeners.set(event, listener);
        return updater;
      }),
      quitAndInstall: jest.fn(),
    };
    return { updater, listeners };
  };

  beforeEach(() => {
    delete process.env.DISPLAY_UPDATE_FEED_ALLOWLIST;
    restoreNodeEnv();
    jest.useFakeTimers();
  });

  afterEach(() => {
    delete process.env.DISPLAY_UPDATE_FEED_ALLOWLIST;
    restoreNodeEnv();
    jest.useRealTimers();
  });

  const restoreNodeEnv = () => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  };

  it('normalizes an allowlisted HTTPS feed URL', () => {
    process.env.DISPLAY_UPDATE_FEED_ALLOWLIST = 'updates.vizora.cloud';

    expect(
      normalizeDisplayUpdateFeedUrl('https://updates.vizora.cloud/display/'),
    ).toBe('https://updates.vizora.cloud/display');
  });

  it('normalizes URL-shaped allowlist entries to their hostname', () => {
    process.env.DISPLAY_UPDATE_FEED_ALLOWLIST = 'https://updates.vizora.cloud';

    expect(
      normalizeDisplayUpdateFeedUrl('https://updates.vizora.cloud/display/'),
    ).toBe('https://updates.vizora.cloud/display');
  });

  it('rejects feed hosts outside the allowlist', () => {
    process.env.DISPLAY_UPDATE_FEED_ALLOWLIST = 'updates.vizora.cloud';

    expect(() =>
      normalizeDisplayUpdateFeedUrl('https://updates.attacker.example/display'),
    ).toThrow('not allowlisted');
  });

  it('rejects non-localhost HTTP feed URLs', () => {
    expect(() =>
      normalizeDisplayUpdateFeedUrl('http://updates.vizora.cloud/display'),
    ).toThrow('must use HTTPS');
  });

  it('rejects non-HTTP update feed protocols', () => {
    expect(() =>
      normalizeDisplayUpdateFeedUrl('file:///tmp/display-update'),
    ).toThrow('must use HTTP or HTTPS');
  });

  it('rejects non-loopback feed URLs with explicit ports', () => {
    expect(() =>
      normalizeDisplayUpdateFeedUrl('https://updates.vizora.cloud:8443/display'),
    ).toThrow('must not include a port');
  });

  it('allows loopback HTTP feeds only outside production', () => {
    process.env.NODE_ENV = 'test';

    expect(
      normalizeDisplayUpdateFeedUrl('http://localhost:4876/display/'),
    ).toBe('http://localhost:4876/display');

    process.env.NODE_ENV = 'production';
    expect(() =>
      normalizeDisplayUpdateFeedUrl('http://localhost:4876/display'),
    ).toThrow('loopback feeds are not allowed in production');
  });

  it('rejects feed URLs with credentials or query strings', () => {
    expect(() =>
      normalizeDisplayUpdateFeedUrl('https://user:pass@updates.vizora.cloud/display'),
    ).toThrow('must not include credentials');

    expect(() =>
      normalizeDisplayUpdateFeedUrl('https://updates.vizora.cloud/display?token=abc'),
    ).toThrow('must not include a query string');
  });

  it('does not call electron-updater for unpackaged display clients', () => {
    const { updater } = createUpdater();

    const result = triggerDisplayAutoUpdate(
      'https://updates.vizora.cloud/display',
      { isPackaged: false, updater },
    );

    expect(result).toEqual({
      status: 'skipped',
      reason: 'not_packaged',
    });
    expect(updater.setFeedURL).not.toHaveBeenCalled();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('throws synchronously for invalid packaged update feeds before updater work', () => {
    process.env.DISPLAY_UPDATE_FEED_ALLOWLIST = 'updates.vizora.cloud';
    const { updater } = createUpdater();

    expect(() =>
      triggerDisplayAutoUpdate('https://updates.attacker.example/display', {
        isPackaged: true,
        updater,
      }),
    ).toThrow('not allowlisted');
    expect(updater.setFeedURL).not.toHaveBeenCalled();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('rejects loopback feeds for packaged display clients even when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    const { updater } = createUpdater();

    expect(() =>
      triggerDisplayAutoUpdate('http://localhost:4876/display', {
        isPackaged: true,
        updater,
      }),
    ).toThrow('loopback feeds are not allowed in production');
    expect(updater.setFeedURL).not.toHaveBeenCalled();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('configures updater and installs after update-downloaded for packaged clients', () => {
    process.env.DISPLAY_UPDATE_FEED_ALLOWLIST = 'updates.vizora.cloud';
    const { updater, listeners } = createUpdater();

    const result = triggerDisplayAutoUpdate(
      'https://updates.vizora.cloud/display/',
      { isPackaged: true, updater, installDelayMs: 0 },
    );

    expect(result).toEqual({
      status: 'started',
      feedUrl: 'https://updates.vizora.cloud/display',
    });
    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
    expect(updater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://updates.vizora.cloud/display',
    });
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    listeners.get('update-downloaded')?.();
    jest.advanceTimersByTime(0);
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });
});
