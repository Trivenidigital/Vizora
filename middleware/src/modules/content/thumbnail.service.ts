import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';
import { lookup } from 'dns/promises';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly THUMBNAIL_DIR = join(__dirname, '..', '..', '..', 'static', 'thumbnails');
  private readonly MAX_SIZE = 300; // 300x300 max
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

  /** Blocked internal hostname patterns */
  private readonly BLOCKED_HOSTNAMES = [
    'localhost',
    '0.0.0.0',
  ];

  /** Blocked hostname suffix patterns (e.g. *.internal, *.local) */
  private readonly BLOCKED_HOSTNAME_SUFFIXES = [
    '.internal',
    '.local',
    '.localhost',
  ];

  constructor() {
    this.ensureThumbnailDir();
  }

  /**
   * Validate a URL is safe to fetch (SSRF protection).
   * Only allows http/https, blocks private IP ranges and internal hostnames.
   */
  private async validateUrl(imageUrl: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      throw new Error(`Invalid URL: ${imageUrl}`);
    }

    // Only allow http and https schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Disallowed URL scheme: ${parsed.protocol}`);
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block known internal hostnames
    if (this.BLOCKED_HOSTNAMES.includes(hostname)) {
      throw new Error(`Blocked internal hostname: ${hostname}`);
    }

    // Block internal hostname suffixes
    for (const suffix of this.BLOCKED_HOSTNAME_SUFFIXES) {
      if (hostname.endsWith(suffix)) {
        throw new Error(`Blocked internal hostname: ${hostname}`);
      }
    }

    // Resolve hostname and check for private IP ranges
    try {
      const result = await lookup(hostname, { all: true });
      const addresses = Array.isArray(result) ? result : [result];

      for (const entry of addresses) {
        const ip = entry.address;
        if (this.isPrivateIp(ip)) {
          throw new Error(`URL resolves to private IP address: ${ip}`);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('URL resolves to')) {
        throw error;
      }
      if (error instanceof Error && error.message.startsWith('Blocked internal')) {
        throw error;
      }
      // DNS resolution failure — block the request
      throw new Error(`Failed to resolve hostname: ${hostname}`);
    }
  }

  /**
   * Check if an IP address is in a private/reserved range.
   */
  private isPrivateIp(ip: string): boolean {
    // IPv6 loopback
    if (ip === '::1') return true;

    // IPv6 private range fc00::/7
    if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
      return true;
    }

    // IPv4 checks
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p))) {
      // Not a valid IPv4 — may be IPv6; conservatively allow
      return false;
    }

    const [a, b] = parts;

    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 10.0.0.0/8 (private)
    if (a === 10) return true;
    // 172.16.0.0/12 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0
    if (a === 0 && b === 0 && parts[2] === 0 && parts[3] === 0) return true;

    return false;
  }

  private async ensureThumbnailDir() {
    try {
      await fs.mkdir(this.THUMBNAIL_DIR, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create thumbnail directory', error);
    }
  }

  /**
   * Generate thumbnail from image file
   * Returns relative URL to thumbnail
   */
  async generateThumbnail(
    contentId: string,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    try {
      // Security: Check file size limit (DoS protection)
      if (imageBuffer.length > this.MAX_FILE_SIZE) {
        this.logger.warn(`Image too large for thumbnail: ${contentId} (${imageBuffer.length} bytes)`);
        throw new Error(`Image exceeds maximum size for thumbnail generation (${this.MAX_FILE_SIZE / 1024 / 1024}MB)`);
      }

      const ext = this.getExtensionFromMime(mimeType);
      const filename = `${contentId}.${ext}`;
      const filepath = join(this.THUMBNAIL_DIR, filename);

      // Generate thumbnail using sharp
      await sharp(imageBuffer)
        .resize(this.MAX_SIZE, this.MAX_SIZE, {
          fit: 'inside', // Maintain aspect ratio
          withoutEnlargement: true, // Don't upscale small images
        })
        .toFile(filepath);

      // Return relative URL
      return `/static/thumbnails/${filename}`;
    } catch (error) {
      this.logger.error(
        `Failed to generate thumbnail for ${contentId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Generate thumbnail from URL (for already uploaded content).
   * Validates the URL against SSRF before fetching.
   */
  async generateThumbnailFromUrl(
    contentId: string,
    imageUrl: string
  ): Promise<string> {
    // Validate URL to prevent SSRF
    try {
      await this.validateUrl(imageUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`SSRF validation failed for thumbnail URL (contentId: ${contentId}): ${message}`);
      throw new Error(`URL validation failed: ${message}`);
    }

    try {
      // Fetch image from URL
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const contentType = response.headers.get('content-type') || 'image/jpeg';

      return this.generateThumbnail(contentId, buffer, contentType);
    } catch (error) {
      this.logger.error(
        `Failed to generate thumbnail from URL for ${contentId}`,
        error
      );
      throw error;
    }
  }

  private getExtensionFromMime(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    return mimeMap[mimeType.toLowerCase()] || 'jpg';
  }

  /**
   * Delete thumbnail file
   */
  async deleteThumbnail(thumbnailUrl: string): Promise<void> {
    try {
      if (!thumbnailUrl || !thumbnailUrl.includes('/thumbnails/')) return;
      
      const filename = thumbnailUrl.split('/').pop();
      if (!filename) return;
      
      const filepath = join(this.THUMBNAIL_DIR, filename);
      await fs.unlink(filepath);
    } catch (error) {
      this.logger.warn(`Failed to delete thumbnail: ${thumbnailUrl}`, error);
    }
  }
}
