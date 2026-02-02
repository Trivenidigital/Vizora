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
      extensions: ['.mp4', '.m4v'],
      maxSize: 100 * 1024 * 1024, // 100MB
      magicNumbers: [
        Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), // ftyp
        Buffer.from([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70]),
        Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]),
      ],
    },
    'video/quicktime': {
      extensions: ['.mov', '.qt'],
      maxSize: 100 * 1024 * 1024, // 100MB
      magicNumbers: [
        Buffer.from([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70]), // ftyp qt
        Buffer.from([0x00, 0x00, 0x00, 0x08, 0x77, 0x69, 0x64, 0x65]), // wide
        Buffer.from([0x6D, 0x6F, 0x6F, 0x76]), // moov
        Buffer.from([0x66, 0x72, 0x65, 0x65]), // free
        Buffer.from([0x6D, 0x64, 0x61, 0x74]), // mdat
      ],
    },
    'video/x-msvideo': {
      extensions: ['.avi'],
      maxSize: 100 * 1024 * 1024, // 100MB
      magicNumbers: [
        Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
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
   * Prevents SSRF attacks by blocking private/internal network addresses
   */
  validateUrl(url: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Only HTTP/HTTPS URLs allowed');
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost variations
    if (this.isLocalhost(hostname)) {
      throw new BadRequestException('Localhost URLs not allowed');
    }

    // Block private/internal IP ranges (RFC 1918 + others)
    if (this.isPrivateIp(hostname)) {
      throw new BadRequestException('Private IP addresses not allowed');
    }

    // Block link-local addresses
    if (this.isLinkLocal(hostname)) {
      throw new BadRequestException('Link-local addresses not allowed');
    }

    // Block cloud metadata endpoints (common SSRF targets)
    if (this.isCloudMetadata(hostname)) {
      throw new BadRequestException('Cloud metadata endpoints not allowed');
    }

    return true;
  }

  /**
   * Check if hostname is localhost
   */
  private isLocalhost(hostname: string): boolean {
    const localhostPatterns = [
      'localhost',
      '127.0.0.1',
      '::1',
      '[::1]',
      '0.0.0.0',
    ];
    return localhostPatterns.includes(hostname) || hostname.endsWith('.localhost');
  }

  /**
   * Check if IP is in private ranges (RFC 1918)
   * - 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
   * - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
   * - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
   */
  private isPrivateIp(hostname: string): boolean {
    // Check if it's an IP address
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);

    if (!match) {
      return false; // Not an IPv4 address
    }

    const octets = match.slice(1).map(Number);
    const [a, b, c, d] = octets;

    // Validate octets are in range
    if (octets.some((o) => o < 0 || o > 255)) {
      return true; // Invalid IP, block it
    }

    // 10.0.0.0/8
    if (a === 10) {
      return true;
    }

    // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }

    // 192.168.0.0/16
    if (a === 192 && b === 168) {
      return true;
    }

    // 127.0.0.0/8 (loopback)
    if (a === 127) {
      return true;
    }

    // 0.0.0.0/8 (current network)
    if (a === 0) {
      return true;
    }

    return false;
  }

  /**
   * Check if IP is link-local (169.254.0.0/16)
   */
  private isLinkLocal(hostname: string): boolean {
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);

    if (!match) {
      return false;
    }

    const [a, b] = match.slice(1).map(Number);
    return a === 169 && b === 254;
  }

  /**
   * Check if hostname is a cloud metadata endpoint
   * These are common SSRF targets that expose sensitive credentials
   */
  private isCloudMetadata(hostname: string): boolean {
    const metadataEndpoints = [
      '169.254.169.254', // AWS, GCP, Azure metadata
      'metadata.google.internal',
      'metadata.goog',
      '169.254.170.2', // AWS ECS task metadata
      'fd00:ec2::254', // AWS IPv6 metadata
    ];

    return metadataEndpoints.some(
      (endpoint) => hostname === endpoint || hostname.endsWith('.' + endpoint),
    );
  }
}
