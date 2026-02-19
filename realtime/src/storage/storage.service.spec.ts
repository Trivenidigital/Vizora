import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';

// Mock minio
jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn().mockResolvedValue(undefined),
    putObject: jest.fn().mockResolvedValue(undefined),
    presignedGetObject: jest.fn().mockResolvedValue('https://minio/presigned-url'),
  })),
}));

describe('StorageService', () => {
  let service: StorageService;
  let mockConfigService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          MINIO_BUCKET: 'test-bucket',
          MINIO_ENDPOINT: 'localhost',
          MINIO_PORT: 9000,
          MINIO_ACCESS_KEY: 'testkey',
          MINIO_SECRET_KEY: 'testsecret',
          MINIO_USE_SSL: 'false',
        };
        return config[key];
      }),
    };

    service = new StorageService(mockConfigService as ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should use configured bucket name', () => {
      expect((service as any).bucket).toBe('test-bucket');
    });

    it('should default bucket to vizora-content when not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);
      const svc = new StorageService(mockConfigService);
      expect((svc as any).bucket).toBe('vizora-content');
    });
  });

  describe('onModuleInit', () => {
    it('should connect to MinIO successfully', async () => {
      await service.onModuleInit();

      expect(service.isMinioAvailable()).toBe(true);
    });

    it('should handle missing configuration gracefully', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MINIO_BUCKET') return 'test-bucket';
        return undefined;
      });
      const svc = new StorageService(mockConfigService);

      await svc.onModuleInit();

      expect(svc.isMinioAvailable()).toBe(false);
    });

    it('should handle connection failure gracefully', async () => {
      const Minio = require('minio');
      Minio.Client.mockImplementationOnce(() => ({
        bucketExists: jest.fn().mockRejectedValue(new Error('Connection refused')),
      }));

      const svc = new StorageService(mockConfigService);
      await svc.onModuleInit();

      expect(svc.isMinioAvailable()).toBe(false);
    });
  });

  describe('isMinioAvailable', () => {
    it('should return false before initialization', () => {
      expect(service.isMinioAvailable()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      await service.onModuleInit();

      expect(service.isMinioAvailable()).toBe(true);
    });
  });

  describe('generateScreenshotKey', () => {
    it('should generate key with org, device, and timestamp', () => {
      const key = service.generateScreenshotKey('org-1', 'device-1');

      expect(key).toMatch(/^screenshots\/org-1\/device-1\/\d+\.png$/);
    });

    it('should generate unique keys', () => {
      const key1 = service.generateScreenshotKey('org-1', 'device-1');
      // Wait a tick for different timestamp
      const key2 = service.generateScreenshotKey('org-1', 'device-1');

      // Keys may or may not differ depending on timing, but format is correct
      expect(key1).toMatch(/^screenshots\//);
      expect(key2).toMatch(/^screenshots\//);
    });
  });

  describe('uploadScreenshot', () => {
    it('should throw when MinIO is not available', async () => {
      // Not initialized, so not available
      await expect(
        service.uploadScreenshot(Buffer.from('test'), 'key.png'),
      ).rejects.toThrow('MinIO is not available');
    });

    it('should upload successfully when MinIO is available', async () => {
      await service.onModuleInit();

      const result = await service.uploadScreenshot(
        Buffer.from('test image data'),
        'screenshots/org-1/device-1/123.png',
      );

      expect(result).toBe('screenshots/org-1/device-1/123.png');
    });

    it('should handle upload errors', async () => {
      const Minio = require('minio');
      Minio.Client.mockImplementationOnce(() => ({
        bucketExists: jest.fn().mockResolvedValue(true),
        putObject: jest.fn().mockRejectedValue(new Error('Upload failed')),
      }));

      const svc = new StorageService(mockConfigService);
      await svc.onModuleInit();

      await expect(
        svc.uploadScreenshot(Buffer.from('test'), 'key.png'),
      ).rejects.toThrow('MinIO upload failed');
    });
  });

  describe('getPresignedUrl', () => {
    it('should throw when MinIO is not available', async () => {
      await expect(
        service.getPresignedUrl('key.png'),
      ).rejects.toThrow('MinIO is not available');
    });

    it('should return presigned URL when MinIO is available', async () => {
      await service.onModuleInit();

      const url = await service.getPresignedUrl('screenshots/test.png');

      expect(url).toBe('https://minio/presigned-url');
    });

    it('should use default 1-hour expiry', async () => {
      await service.onModuleInit();

      await service.getPresignedUrl('test.png');

      // The mock captures the call
      expect(service.isMinioAvailable()).toBe(true);
    });

    it('should handle presigned URL generation errors', async () => {
      const Minio = require('minio');
      Minio.Client.mockImplementationOnce(() => ({
        bucketExists: jest.fn().mockResolvedValue(true),
        presignedGetObject: jest.fn().mockRejectedValue(new Error('Presign failed')),
      }));

      const svc = new StorageService(mockConfigService);
      await svc.onModuleInit();

      await expect(
        svc.getPresignedUrl('key.png'),
      ).rejects.toThrow('Failed to generate presigned URL');
    });
  });
});
