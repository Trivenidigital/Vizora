import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { app } from 'electron';

interface CacheManifestEntry {
  contentId: string;
  filePath: string;
  size: number;
  mimeType: string;
  lastAccessed: number;
  downloadedAt: number;
}

interface CacheManifest {
  entries: Record<string, CacheManifestEntry>;
  version: number;
}

export class CacheManager {
  private cacheDir: string;
  private manifestPath: string;
  private manifest: CacheManifest;
  private maxCacheSizeMB: number;
  private downloadingSet: Set<string> = new Set();

  constructor(maxCacheSizeMB = 500) {
    this.cacheDir = path.join(app.getPath('userData'), 'content-cache');
    this.manifestPath = path.join(this.cacheDir, 'manifest.json');
    this.maxCacheSizeMB = maxCacheSizeMB;
    this.manifest = { entries: {}, version: 1 };
    this.ensureCacheDir();
    this.loadManifest();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private loadManifest(): void {
    try {
      if (fs.existsSync(this.manifestPath)) {
        const data = fs.readFileSync(this.manifestPath, 'utf-8');
        this.manifest = JSON.parse(data);
      }
    } catch (error) {
      console.error('[CacheManager] Failed to load manifest:', error);
      this.manifest = { entries: {}, version: 1 };
    }
  }

  private saveManifest(): void {
    try {
      fs.writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2));
    } catch (error) {
      console.error('[CacheManager] Failed to save manifest:', error);
    }
  }

  async downloadContent(id: string, url: string, mimeType: string): Promise<string> {
    // Prevent duplicate downloads
    if (this.downloadingSet.has(id)) {
      // Wait for existing download
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (!this.downloadingSet.has(id)) {
            clearInterval(check);
            const cached = this.getCachedPath(id);
            resolve(cached || url);
          }
        }, 500);
      });
    }

    // Check if already cached
    const existing = this.getCachedPath(id);
    if (existing) return existing;

    this.downloadingSet.add(id);

    try {
      const ext = this.getExtension(url, mimeType);
      const fileName = `${id}.${ext}`;
      const filePath = path.join(this.cacheDir, fileName);

      await this.downloadFile(url, filePath);

      const stats = fs.statSync(filePath);

      this.manifest.entries[id] = {
        contentId: id,
        filePath,
        size: stats.size,
        mimeType,
        lastAccessed: Date.now(),
        downloadedAt: Date.now(),
      };

      this.saveManifest();
      await this.enforceMaxCacheSize();

      console.log(`[CacheManager] Cached content ${id} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return filePath;
    } catch (error) {
      console.error(`[CacheManager] Failed to cache content ${id}:`, error);
      return url; // Fall back to network URL
    } finally {
      this.downloadingSet.delete(id);
    }
  }

  getCachedPath(id: string): string | null {
    const entry = this.manifest.entries[id];
    if (!entry) return null;

    // Verify file still exists
    if (!fs.existsSync(entry.filePath)) {
      delete this.manifest.entries[id];
      this.saveManifest();
      return null;
    }

    // Update last accessed
    entry.lastAccessed = Date.now();
    this.saveManifest();

    return entry.filePath;
  }

  async enforceMaxCacheSize(): Promise<void> {
    const maxBytes = this.maxCacheSizeMB * 1024 * 1024;
    let totalSize = this.getTotalSize();

    if (totalSize <= maxBytes) return;

    // Sort by last accessed (oldest first) for LRU eviction
    const entries = Object.values(this.manifest.entries)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    for (const entry of entries) {
      if (totalSize <= maxBytes) break;

      try {
        if (fs.existsSync(entry.filePath)) {
          fs.unlinkSync(entry.filePath);
        }
        totalSize -= entry.size;
        delete this.manifest.entries[entry.contentId];
        console.log(`[CacheManager] Evicted ${entry.contentId} (LRU)`);
      } catch (error) {
        console.error(`[CacheManager] Failed to evict ${entry.contentId}:`, error);
      }
    }

    this.saveManifest();
  }

  clearCache(): void {
    try {
      for (const entry of Object.values(this.manifest.entries)) {
        try {
          if (fs.existsSync(entry.filePath)) {
            fs.unlinkSync(entry.filePath);
          }
        } catch (e) {
          // Continue clearing
        }
      }
      this.manifest = { entries: {}, version: 1 };
      this.saveManifest();
      console.log('[CacheManager] Cache cleared');
    } catch (error) {
      console.error('[CacheManager] Failed to clear cache:', error);
    }
  }

  getCacheStats(): { itemCount: number; totalSizeMB: number; maxSizeMB: number } {
    return {
      itemCount: Object.keys(this.manifest.entries).length,
      totalSizeMB: Math.round(this.getTotalSize() / 1024 / 1024 * 100) / 100,
      maxSizeMB: this.maxCacheSizeMB,
    };
  }

  removeItem(id: string): void {
    const entry = this.manifest.entries[id];
    if (entry) {
      try {
        if (fs.existsSync(entry.filePath)) {
          fs.unlinkSync(entry.filePath);
        }
      } catch (e) {
        // Continue
      }
      delete this.manifest.entries[id];
      this.saveManifest();
    }
  }

  private getTotalSize(): number {
    return Object.values(this.manifest.entries).reduce((sum, e) => sum + e.size, 0);
  }

  private getExtension(url: string, mimeType: string): string {
    // Try to get from URL
    try {
      const urlPath = new URL(url).pathname;
      const ext = path.extname(urlPath).slice(1);
      if (ext) return ext;
    } catch {}

    // Fall back to MIME type
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
    };
    return mimeMap[mimeType] || 'bin';
  }

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Fix localhost for IPv4
      const fixedUrl = url.replace(/localhost/g, '127.0.0.1');
      const protocol = fixedUrl.startsWith('https') ? https : http;

      const file = fs.createWriteStream(destPath);
      protocol.get(fixedUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Follow redirect
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            try { fs.unlinkSync(destPath); } catch {}
            this.downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          try { fs.unlinkSync(destPath); } catch {}
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        reject(err);
      });
    });
  }
}
