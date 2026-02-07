import { BadRequestException } from '@nestjs/common';
import { FileValidationService } from './file-validation.service';

describe('FileValidationService', () => {
  let service: FileValidationService;

  beforeEach(() => {
    service = new FileValidationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateFile', () => {
    describe('MIME Type Validation', () => {
      it('should reject disallowed MIME types', async () => {
        const file = Buffer.from('test content');

        await expect(
          service.validateFile(file, 'test.exe', 'application/x-msdownload'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should accept allowed MIME types', async () => {
        // Valid JPEG magic numbers
        const jpegFile = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.alloc(100),
        ]);

        const result = await service.validateFile(
          jpegFile,
          'test.jpg',
          'image/jpeg',
        );

        expect(result.valid).toBe(true);
        expect(result.actualType).toBe('image/jpeg');
      });
    });

    describe('Extension Validation', () => {
      it('should reject mismatched extensions', async () => {
        const pngFile = Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.alloc(100),
        ]);

        await expect(
          service.validateFile(pngFile, 'test.jpg', 'image/png'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should accept matching extensions', async () => {
        const pngFile = Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.alloc(100),
        ]);

        const result = await service.validateFile(
          pngFile,
          'test.png',
          'image/png',
        );

        expect(result.valid).toBe(true);
      });

      it('should handle case-insensitive extensions', async () => {
        const pngFile = Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.alloc(100),
        ]);

        const result = await service.validateFile(
          pngFile,
          'test.PNG',
          'image/png',
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('File Size Validation', () => {
      it('should reject files exceeding size limit', async () => {
        // Create a file larger than 10MB for images
        const largeFile = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.alloc(11 * 1024 * 1024),
        ]);

        await expect(
          service.validateFile(largeFile, 'large.jpg', 'image/jpeg'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should accept files within size limit', async () => {
        const smallFile = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.alloc(100),
        ]);

        const result = await service.validateFile(
          smallFile,
          'small.jpg',
          'image/jpeg',
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Magic Number Validation', () => {
      it('should reject MIME type spoofing (wrong magic numbers)', async () => {
        // File claims to be JPEG but has PNG magic numbers
        const spoofedFile = Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.alloc(100),
        ]);

        await expect(
          service.validateFile(spoofedFile, 'fake.jpg', 'image/jpeg'),
        ).rejects.toThrow('File content does not match declared type');
      });

      it('should accept files with correct magic numbers', async () => {
        const validJpeg = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.alloc(100),
        ]);

        const result = await service.validateFile(
          validJpeg,
          'valid.jpg',
          'image/jpeg',
        );

        expect(result.valid).toBe(true);
      });

      it('should validate PNG magic numbers', async () => {
        const validPng = Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.alloc(100),
        ]);

        const result = await service.validateFile(
          validPng,
          'valid.png',
          'image/png',
        );

        expect(result.valid).toBe(true);
      });

      it('should validate PDF magic numbers', async () => {
        const validPdf = Buffer.concat([
          Buffer.from([0x25, 0x50, 0x44, 0x46]),
          Buffer.alloc(100),
        ]);

        const result = await service.validateFile(
          validPdf,
          'document.pdf',
          'application/pdf',
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Suspicious Content Detection', () => {
      it('should reject files with embedded scripts', async () => {
        const maliciousFile = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.from('<script>alert("xss")</script>'),
        ]);

        await expect(
          service.validateFile(maliciousFile, 'evil.jpg', 'image/jpeg'),
        ).rejects.toThrow('suspicious content');
      });

      it('should reject files with javascript: URLs', async () => {
        const maliciousFile = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.from('javascript:alert(1)'),
        ]);

        await expect(
          service.validateFile(maliciousFile, 'evil.jpg', 'image/jpeg'),
        ).rejects.toThrow('suspicious content');
      });

      it('should reject files with event handlers', async () => {
        const maliciousFile = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.from('onerror=alert(1)'),
        ]);

        await expect(
          service.validateFile(maliciousFile, 'evil.jpg', 'image/jpeg'),
        ).rejects.toThrow('suspicious content');
      });

      it('should reject PDFs with JavaScript', async () => {
        const maliciousPdf = Buffer.concat([
          Buffer.from([0x25, 0x50, 0x44, 0x46]),
          Buffer.from('%PDF-1.4 /JS (alert)'),
        ]);

        await expect(
          service.validateFile(maliciousPdf, 'evil.pdf', 'application/pdf'),
        ).rejects.toThrow('suspicious content');
      });
    });

    describe('Hash Generation', () => {
      it('should return SHA-256 hash of file content', async () => {
        const file = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.from('test content'),
        ]);

        const result = await service.validateFile(
          file,
          'test.jpg',
          'image/jpeg',
        );

        expect(result.hash).toBeDefined();
        expect(result.hash).toHaveLength(64); // SHA-256 hex length
      });

      it('should return same hash for identical files', async () => {
        const file1 = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.from('identical content'),
        ]);
        const file2 = Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.from('identical content'),
        ]);

        const result1 = await service.validateFile(
          file1,
          'test1.jpg',
          'image/jpeg',
        );
        const result2 = await service.validateFile(
          file2,
          'test2.jpg',
          'image/jpeg',
        );

        expect(result1.hash).toBe(result2.hash);
      });
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove path separators (directory traversal prevention)', () => {
      const sanitized = service.sanitizeFilename('../../../etc/passwd');
      // Path separators are removed
      expect(sanitized).not.toContain('/');
      // Dots become underscores when not adjacent to word chars
      // The important security aspect is path separators are removed
    });

    it('should remove backslashes', () => {
      expect(service.sanitizeFilename('..\\..\\windows\\system32')).not.toContain(
        '\\',
      );
    });

    it('should replace special characters with underscores', () => {
      const sanitized = service.sanitizeFilename('file<>:"|?*.txt');
      expect(sanitized).not.toMatch(/[<>:"|?*]/);
    });

    it('should preserve safe characters', () => {
      const sanitized = service.sanitizeFilename('my-file_name.txt');
      expect(sanitized).toBe('my-file_name.txt');
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const sanitized = service.sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });
  });

  describe('validateUrl', () => {
    describe('Protocol Validation', () => {
      it('should accept HTTPS URLs', async () => {
        await expect(service.validateUrl('https://example.com')).resolves.toBe(true);
      });

      it('should accept HTTP URLs', async () => {
        await expect(service.validateUrl('http://example.com')).resolves.toBe(true);
      });

      it('should reject non-HTTP protocols', async () => {
        await expect(service.validateUrl('ftp://example.com')).rejects.toThrow(
          'Only HTTP/HTTPS URLs allowed',
        );
        await expect(service.validateUrl('file:///etc/passwd')).rejects.toThrow(
          'Only HTTP/HTTPS URLs allowed',
        );
        await expect(service.validateUrl('javascript:alert(1)')).rejects.toThrow(
          'Only HTTP/HTTPS URLs allowed',
        );
      });
    });

    describe('Localhost Blocking', () => {
      it('should block localhost', async () => {
        await expect(service.validateUrl('http://localhost')).rejects.toThrow(
          'Localhost URLs not allowed',
        );
      });

      it('should block 127.0.0.1', async () => {
        await expect(service.validateUrl('http://127.0.0.1')).rejects.toThrow(
          'Localhost URLs not allowed',
        );
      });

      it('should block IPv6 localhost', async () => {
        await expect(service.validateUrl('http://[::1]')).rejects.toThrow(
          'Localhost URLs not allowed',
        );
      });

      it('should block 0.0.0.0', async () => {
        await expect(service.validateUrl('http://0.0.0.0')).rejects.toThrow(
          'Localhost URLs not allowed',
        );
      });

      it('should block subdomain of localhost', async () => {
        await expect(service.validateUrl('http://api.localhost')).rejects.toThrow(
          'Localhost URLs not allowed',
        );
      });
    });

    describe('Private IP Blocking (SSRF Prevention)', () => {
      it('should block 10.0.0.0/8 range', async () => {
        await expect(service.validateUrl('http://10.0.0.1')).rejects.toThrow(
          'Private IP addresses not allowed',
        );
        await expect(service.validateUrl('http://10.255.255.255')).rejects.toThrow(
          'Private IP addresses not allowed',
        );
      });

      it('should block 172.16.0.0/12 range', async () => {
        await expect(service.validateUrl('http://172.16.0.1')).rejects.toThrow(
          'Private IP addresses not allowed',
        );
        await expect(service.validateUrl('http://172.31.255.255')).rejects.toThrow(
          'Private IP addresses not allowed',
        );
      });

      it('should NOT block 172.32.0.0 (outside /12 range)', async () => {
        // This is a public IP range
        await expect(service.validateUrl('http://172.32.0.1')).resolves.toBe(true);
      });

      it('should block 192.168.0.0/16 range', async () => {
        await expect(service.validateUrl('http://192.168.0.1')).rejects.toThrow(
          'Private IP addresses not allowed',
        );
        await expect(service.validateUrl('http://192.168.255.255')).rejects.toThrow(
          'Private IP addresses not allowed',
        );
      });

      it('should block 127.0.0.0/8 loopback range', async () => {
        await expect(service.validateUrl('http://127.0.0.1')).rejects.toThrow();
        await expect(service.validateUrl('http://127.255.255.255')).rejects.toThrow();
      });
    });

    describe('Link-Local Blocking', () => {
      it('should block 169.254.0.0/16 range', async () => {
        await expect(service.validateUrl('http://169.254.0.1')).rejects.toThrow(
          'Link-local addresses not allowed',
        );
        await expect(service.validateUrl('http://169.254.169.254')).rejects.toThrow(
          'Link-local addresses not allowed',
        );
      });
    });

    describe('Cloud Metadata Endpoint Blocking', () => {
      it('should block AWS metadata endpoint', async () => {
        await expect(service.validateUrl('http://169.254.169.254')).rejects.toThrow();
      });

      it('should block GCP metadata endpoint', async () => {
        await expect(
          service.validateUrl('http://metadata.google.internal'),
        ).rejects.toThrow('Cloud metadata endpoints not allowed');
      });

      it('should block AWS ECS metadata endpoint', async () => {
        await expect(service.validateUrl('http://169.254.170.2')).rejects.toThrow();
      });
    });

    describe('Valid URLs', () => {
      it('should accept public domain names', async () => {
        await expect(service.validateUrl('https://www.google.com')).resolves.toBe(true);
        await expect(service.validateUrl('https://api.example.com/path')).resolves.toBe(true);
      });

      it('should accept public IP addresses', async () => {
        await expect(service.validateUrl('http://8.8.8.8')).resolves.toBe(true);
        await expect(service.validateUrl('https://1.1.1.1')).resolves.toBe(true);
      });
    });

    describe('Invalid URL Format', () => {
      it('should reject invalid URLs', async () => {
        await expect(service.validateUrl('not-a-url')).rejects.toThrow(
          'Invalid URL format',
        );
        await expect(service.validateUrl('')).rejects.toThrow('Invalid URL format');
      });
    });
  });
});
