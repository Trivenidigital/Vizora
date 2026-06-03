export interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  setFeedURL(options: { provider: 'generic'; url: string }): void;
  checkForUpdates(): Promise<unknown>;
  on(event: string, listener: () => void): unknown;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export type DisplayAutoUpdateResult =
  | { status: 'started'; feedUrl: string }
  | { status: 'skipped'; reason: 'not_packaged' };

interface TriggerDisplayAutoUpdateOptions {
  isPackaged?: boolean;
  updater?: AutoUpdaterLike;
  installDelayMs?: number;
}

interface NormalizeDisplayUpdateFeedUrlOptions {
  allowLoopback?: boolean;
}

const DEFAULT_DISPLAY_UPDATE_FEED_HOST = 'updates.vizora.cloud';
const LOCAL_UPDATE_FEED_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const installListeners = new WeakSet<object>();

export function normalizeDisplayUpdateFeedUrl(
  rawFeedUrl: unknown,
  options: NormalizeDisplayUpdateFeedUrlOptions = {},
): string {
  if (typeof rawFeedUrl !== 'string' || rawFeedUrl.trim().length === 0) {
    throw new Error('display update feed URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawFeedUrl.trim());
  } catch {
    throw new Error('display update feed URL must be a valid URL');
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('display update feed URL must use HTTP or HTTPS');
  }

  const host = normalizeFeedHost(parsed.hostname);
  const isLocal = LOCAL_UPDATE_FEED_HOSTS.has(host);
  const allowLoopback = options.allowLoopback ?? isLoopbackUpdateFeedAllowed();
  if (isLocal && !allowLoopback) {
    throw new Error('display update loopback feeds are not allowed in production');
  }
  if (parsed.protocol === 'http:' && !isLocal) {
    throw new Error('display update feed URL must use HTTPS');
  }
  if (parsed.port && !isLocal) {
    throw new Error('display update feed URL must not include a port');
  }

  if (parsed.username || parsed.password) {
    throw new Error('display update feed URL must not include credentials');
  }

  if (parsed.search) {
    throw new Error('display update feed URL must not include a query string');
  }

  if (!isLocal && !getAllowedFeedHosts().has(host)) {
    throw new Error(`display update feed host is not allowlisted: ${host}`);
  }

  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

/**
 * Triggers an unattended display update from an allowlisted generic feed.
 *
 * Production rollout requires signed display artifacts on the official update
 * feed before operators send this command. This helper only constrains where
 * updates may come from and delegates package verification/install mechanics to
 * electron-updater.
 */
export function triggerDisplayAutoUpdate(
  rawFeedUrl: unknown,
  options: TriggerDisplayAutoUpdateOptions = {},
): DisplayAutoUpdateResult {
  const isPackaged = options.isPackaged ?? getElectronIsPackaged();
  if (!isPackaged) {
    console.log('[DisplayAutoUpdater] Skipping update check because app is not packaged');
    return { status: 'skipped', reason: 'not_packaged' };
  }

  const feedUrl = normalizeDisplayUpdateFeedUrl(rawFeedUrl, {
    allowLoopback: !isPackaged,
  });
  const updater = options.updater ?? getElectronAutoUpdater();
  const installDelayMs = options.installDelayMs ?? 2000;

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  registerInstallListener(updater, installDelayMs);

  updater.setFeedURL({ provider: 'generic', url: feedUrl });
  void updater.checkForUpdates().catch((error: unknown) => {
    console.error('[DisplayAutoUpdater] Update check failed:', error);
  });

  console.log(`[DisplayAutoUpdater] Update check started from ${feedUrl}`);
  return { status: 'started', feedUrl };
}

function registerInstallListener(
  updater: AutoUpdaterLike,
  installDelayMs: number,
): void {
  if (installListeners.has(updater as object)) {
    return;
  }

  updater.on('update-downloaded', () => {
    console.log('[DisplayAutoUpdater] Update downloaded; installing');
    setTimeout(() => {
      try {
        updater.quitAndInstall(false, true);
      } catch (error) {
        console.error('[DisplayAutoUpdater] Failed to install downloaded update:', error);
      }
    }, installDelayMs);
  });
  installListeners.add(updater as object);
}

function getAllowedFeedHosts(): Set<string> {
  const configured =
    process.env.DISPLAY_UPDATE_FEED_ALLOWLIST ||
    DEFAULT_DISPLAY_UPDATE_FEED_HOST;

  return new Set(
    configured
      .split(',')
      .map((host) => normalizeAllowedFeedHost(host.trim()))
      .filter(Boolean),
  );
}

function normalizeFeedHost(host: string): string {
  return host.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
}

function normalizeAllowedFeedHost(host: string): string {
  if (host.includes('://')) {
    try {
      return normalizeFeedHost(new URL(host).hostname);
    } catch {
      return normalizeFeedHost(host);
    }
  }
  return normalizeFeedHost(host);
}

function isLoopbackUpdateFeedAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function getElectronIsPackaged(): boolean {
  try {
    const { app } = require('electron');
    return Boolean(app?.isPackaged);
  } catch {
    return false;
  }
}

function getElectronAutoUpdater(): AutoUpdaterLike {
  const { autoUpdater } = require('electron-updater');
  return autoUpdater as AutoUpdaterLike;
}
