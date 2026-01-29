import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly THUMBNAIL_DIR = join(process.cwd(), 'static', 'thumbnails');
  private readonly MAX_SIZE = 300; // 300x300 max
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

  constructor() {
    this.ensureThumbnailDir();
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
   * Generate thumbnail from URL (for already uploaded content)
   */
  async generateThumbnailFromUrl(
    contentId: string,
    imageUrl: string
  ): Promise<string> {
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
