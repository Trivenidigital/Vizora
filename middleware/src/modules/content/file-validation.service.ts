import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class FileValidationService {
  // Allowed MIME types with their magic number signatures
  private readonly allowedTypes = {
    // Images
    'image/jpeg': {
      extensions: ['.jpg', '.jpeg'],
      maxSize: 10 * 1024 * 1024, // 10MB
      magicNumbers: [
        Buffer.from([0xFF, 0xD8, 0xFF]), // JPEG
      ],
    },
    'image/png': {
      extensions: ['.png'],
      maxSize: 10 * 1024 * 1024,
      magicNumbers: [
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG
      ],
    },
    'image/gif': {
      extensions: ['.gif'],
      maxSize: 10 * 1024 * 1024,
      magicNumbers: [
        Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
        Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
      ],
    },
    'image/webp': {
      extensions: ['.webp'],
      maxSize: 10 * 1024 * 1024,
      magicNumbers: [
        Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF (WebP container)
      ],
    },
    // Videos
    'video/mp4': {
      extensions: ['.mp4'],
      maxSize: 100 * 1024 * 1024, // 100MB
      magicNumbers: [
        Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), // ftyp
        Buffer.from([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70]),
        Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]),
      ],
    },
    'video/webm': {
      extensions: ['.webm'],
      maxSize: 100 * 1024 * 1024,
      magicNumbers: [
        Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), // WebM
      ],
    },
    // Documents
    'application/pdf': {
      extensions: ['.pdf'],
      maxSize: 50 * 1024 * 1024, // 50MB
      magicNumbers: [
        Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
      ],
    },
  };

  /**
   * Validate file upload
   * @param file - Buffer or file data
   * @param filename - Original filename
   * @param mimeType - Declared MIME type
   * @returns Validated file info
   */
  async validateFile(
    file: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<{ valid: boolean; actualType?: string; hash: string }> {
    // 1. Check if MIME type is allowed
    if (!this.allowedTypes[mimeType]) {
      throw new BadRequestException(
        `File type not allowed. Allowed: ${Object.keys(this.allowedTypes).join(', ')}`,
      );
    }

    const typeConfig = this.allowedTypes[mimeType];

    // 2. Validate file extension
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (!typeConfig.extensions.includes(extension)) {
      throw new BadRequestException(
        `Invalid file extension. Expected: ${typeConfig.extensions.join(', ')}`,
      );
    }

    // 3. Check file size
    if (file.length > typeConfig.maxSize) {
      throw new BadRequestException(
        `File too large. Max size: ${typeConfig.maxSize / (1024 * 1024)}MB`,
      );
    }

    // 4. Verify magic numbers (prevent MIME type spoofing)
    const validMagicNumber = typeConfig.magicNumbers.some((magic) => {
      return file.slice(0, magic.length).equals(magic);
    });

    if (!validMagicNumber) {
      throw new BadRequestException(
        'File content does not match declared type (possible spoofing attempt)',
      );
    }

    // 5. Scan for suspicious content (basic checks)
    const suspicious = this.detectSuspiciousContent(file);
    if (suspicious) {
      throw new BadRequestException(
        'File contains suspicious content and has been rejected',
      );
    }

    // 6. Generate file hash for deduplication/integrity
    const hash = crypto.createHash('sha256').update(file).digest('hex');

    return {
      valid: true,
      actualType: mimeType,
      hash,
    };
  }

  /**
   * Basic malware/script detection
   * Checks for embedded scripts, suspicious strings
   */
  private detectSuspiciousContent(file: Buffer): boolean {
    const content = file.toString('utf-8', 0, Math.min(file.length, 10000)); // Check first 10KB

    // Suspicious patterns that shouldn't be in media files
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i,
      /eval\(/i,
      /base64,/i, // Base64-encoded executables
      /%PDF.*\/JS/i, // PDF with JavaScript
      /\/EmbeddedFile/i, // PDF with embedded files
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Generate safe filename (prevent directory traversal)
   */
  sanitizeFilename(filename: string): string {
    // Remove path separators and dangerous characters
    return filename
      .replace(/[\/\\]/g, '')
      .replace(/[^\w.-]/g, '_')
      .substring(0, 255); // Max filename length
  }

  /**
   * Check if URL is safe (for external content)
   */
  validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BadRequestException('Only HTTP/HTTPS URLs allowed');
      }

      // Block localhost and private IPs (SSRF prevention)
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      ) {
        throw new BadRequestException('Private IP addresses not allowed');
      }

      return true;
    } catch (error) {
      throw new BadRequestException('Invalid URL format');
    }
  }
}
