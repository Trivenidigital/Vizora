import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';
import { assertUrlIsPublic, fetchWithSsrfGuard } from '../common/utils/ssrf-guard';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly THUMBNAIL_DIR = join(process.cwd(), 'static', 'thumbnails');
  private readonly MAX_SIZE = 300; // 300x300 max
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

  constructor() {
    this.ensureThumbnailDir();
  }

  /**
   * Validate a URL is safe to fetch (SSRF protection).
   * Only allows http/https, blocks private IP ranges and internal hostnames.
   */
  private async validateUrl(imageUrl: string): Promise<void> {
    await assertUrlIsPublic(imageUrl, { allowHttp: true });
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
      const safeId = contentId.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeId) throw new Error('Invalid content ID');
      const filename = `${safeId}.${ext}`;
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

  async generateThumbnailFromPath(
    contentId: string,
    imagePath: string,
    mimeType: string,
  ): Promise<string> {
    try {
      const stat = await fs.stat(imagePath);
      if (stat.size > this.MAX_FILE_SIZE) {
        this.logger.warn(`Image too large for thumbnail: ${contentId} (${stat.size} bytes)`);
        throw new Error(`Image exceeds maximum size for thumbnail generation (${this.MAX_FILE_SIZE / 1024 / 1024}MB)`);
      }

      const ext = this.getExtensionFromMime(mimeType);
      const safeId = contentId.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeId) throw new Error('Invalid content ID');
      const filename = `${safeId}.${ext}`;
      const filepath = join(this.THUMBNAIL_DIR, filename);

      await sharp(imagePath)
        .resize(this.MAX_SIZE, this.MAX_SIZE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toFile(filepath);

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
      // Fetch image from URL with streaming size check
      const response = await fetchWithSsrfGuard(imageUrl, {}, {
        allowHttp: true,
        maxRedirects: 3,
        skipInitialValidation: true,
      });
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > this.MAX_FILE_SIZE) {
        throw new Error('Image too large for thumbnail generation');
      }

      // Stream the response body with size enforcement to prevent
      // Content-Length spoofing (header says small, body is huge)
      const chunks: Buffer[] = [];
      let totalLength = 0;
      if (response.body) {
        for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
          totalLength += chunk.length;
          if (totalLength > this.MAX_FILE_SIZE) {
            throw new Error('Image exceeds maximum size during download');
          }
          chunks.push(Buffer.from(chunk));
        }
      }
      const buffer = Buffer.concat(chunks);

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
