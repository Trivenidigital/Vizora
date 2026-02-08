import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

// Mock the minio module
jest.mock('minio', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      bucketExists: jest.fn(),
      makeBucket: jest.fn(),
      putObject: jest.fn(),
      presignedGetObject: jest.fn(),
      removeObject: jest.fn(),
      statObject: jest.fn(),
      listObjects: jest.fn(),
      copyObject: jest.fn(),
    })),
    CopyConditions: jest.fn().mockImplementation(() => ({})),
  };
});

describe('StorageService', () => {
  let service: StorageService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockMinioClient: any;

  const defaultConfig = {
    MINIO_ENDPOINT: 'localhost',
    MINIO_PORT: '9000',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MINIO_BUCKET: 'vizora-content',
    MINIO_USE_SSL: 'false',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigService = {
      get: jest.fn((key: string) => defaultConfig[key]),
    } as any;

    // Get the mocked Minio.Client
    const Minio = require('minio');
    mockMinioClient = {
      bucketExists: jest.fn().mockResolvedValue(true),
      makeBucket: jest.fn().mockResolvedValue(undefined),
      putObject: jest.fn().mockResolvedValue({ etag: 'test-etag' }),
      presignedGetObject: jest.fn().mockResolvedValue('https://presigned.url'),
      removeObject: jest.fn().mockResolvedValue(undefined),
      statObject: jest.fn().mockResolvedValue({
        size: 1024,
        lastModified: new Date('2024-01-01'),
        metaData: { 'content-type': 'image/png' },
      }),
      listObjects: jest.fn(),
      copyObject: jest.fn().mockResolvedValue(undefined),
    };
    Minio.Client.mockImplementation(() => mockMinioClient);

    service = new StorageService(mockConfigService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with correct bucket name from config', () => {
      expect(service.getBucket()).toBe('vizora-content');
    });

    it('should connect to MinIO on module init', async () => {
      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('vizora-content');
      expect(service.isMinioAvailable()).toBe(true);
    });

    it('should create bucket if it does not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);

      await service.onModuleInit();

      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('vizora-content');
    });

    it('should not create bucket if it already exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('should handle connection failure gracefully', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection refused'));

      await service.onModuleInit();

      expect(service.isMinioAvailable()).toBe(false);
    });

    it('should set available to false when MinIO config is incomplete', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MINIO_ENDPOINT') return undefined;
        return defaultConfig[key];
      });

      const serviceWithIncompleteConfig = new StorageService(mockConfigService);
      await serviceWithIncompleteConfig.onModuleInit();

      expect(serviceWithIncompleteConfig.isMinioAvailable()).toBe(false);
    });

    it('should handle missing access key gracefully', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MINIO_ACCESS_KEY') return undefined;
        return defaultConfig[key];
      });

      const serviceWithMissingKey = new StorageService(mockConfigService);
      await serviceWithMissingKey.onModuleInit();

      expect(serviceWithMissingKey.isMinioAvailable()).toBe(false);
    });

    it('should handle missing secret key gracefully', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MINIO_SECRET_KEY') return undefined;
        return defaultConfig[key];
      });

      const serviceWithMissingSecret = new StorageService(mockConfigService);
      await serviceWithMissingSecret.onModuleInit();

      expect(serviceWithMissingSecret.isMinioAvailable()).toBe(false);
    });

    it('should use SSL when MINIO_USE_SSL is true', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MINIO_USE_SSL') return 'true';
        return defaultConfig[key];
      });

      const Minio = require('minio');
      const serviceWithSSL = new StorageService(mockConfigService);
      await serviceWithSSL.onModuleInit();

      expect(Minio.Client).toHaveBeenCalledWith(
        expect.objectContaining({
          useSSL: true,
        }),
      );
    });

    it('should use default port when not specified', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MINIO_PORT') return undefined;
        return defaultConfig[key];
      });

      const Minio = require('minio');
      const serviceWithDefaultPort = new StorageService(mockConfigService);
      await serviceWithDefaultPort.onModuleInit();

      expect(Minio.Client).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 9000,
        }),
      );
    });

    it('should use default bucket name when not specified', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MINIO_BUCKET') return undefined;
        return defaultConfig[key];
      });

      const serviceWithDefaultBucket = new StorageService(mockConfigService);
      expect(serviceWithDefaultBucket.getBucket()).toBe('vizora-content');
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

    it('should return false after failed initialization', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection failed'));

      await service.onModuleInit();

      expect(service.isMinioAvailable()).toBe(false);
    });
  });

  describe('generateObjectKey', () => {
    it('should generate correct object key format', () => {
      const key = service.generateObjectKey('org-123', 'abc123', 'test.jpg');
      expect(key).toBe('org-123/abc123-test.jpg');
    });

    it('should sanitize filename with spaces', () => {
      const key = service.generateObjectKey('org-123', 'abc123', 'my file name.jpg');
      expect(key).toBe('org-123/abc123-my_file_name.jpg');
    });

    it('should sanitize filename with special characters', () => {
      const key = service.generateObjectKey('org-123', 'abc123', 'file:name*.jpg');
      expect(key).toBe('org-123/abc123-file-name-.jpg');
    });

    it('should convert filename to lowercase', () => {
      const key = service.generateObjectKey('org-123', 'abc123', 'MyFile.JPG');
      expect(key).toBe('org-123/abc123-myfile.jpg');
    });

    it('should handle path separators in filename', () => {
      const key = service.generateObjectKey('org-123', 'abc123', 'path/to/file.jpg');
      expect(key).toBe('org-123/abc123-path-to-file.jpg');
    });

    it('should handle backslashes in filename', () => {
      const key = service.generateObjectKey('org-123', 'abc123', 'path\\to\\file.jpg');
      expect(key).toBe('org-123/abc123-path-to-file.jpg');
    });

    it('should handle multiple consecutive spaces', () => {
      const key = service.generateObjectKey('org-123', 'abc123', 'my   file.jpg');
      expect(key).toBe('org-123/abc123-my_file.jpg');
    });

    it('should handle question marks in filename', () => {
      const key = service.generateObjectKey('org-123', 'abc123', 'what?.jpg');
      expect(key).toBe('org-123/abc123-what-.jpg');
    });

    it('should handle angle brackets in filename', () => {
      const key = service.generateObjectKey('org-123', 'abc123', '<file>.jpg');
      expect(key).toBe('org-123/abc123--file-.jpg');
    });

    it('should handle pipe character in filename', () => {
      const key = service.generateObjectKey('org-123', 'abc123', 'file|name.jpg');
      expect(key).toBe('org-123/abc123-file-name.jpg');
    });
  });

  describe('uploadFile', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should upload file successfully', async () => {
      const buffer = Buffer.from('test content');
      const objectKey = 'org-123/abc123-test.jpg';

      const result = await service.uploadFile(buffer, objectKey, 'image/jpeg');

      expect(result).toBe(objectKey);
      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'vizora-content',
        objectKey,
        buffer,
        buffer.length,
        { 'Content-Type': 'image/jpeg' },
      );
    });

    it('should throw error when MinIO is not available', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection failed'));
      const serviceUnavailable = new StorageService(mockConfigService);
      await serviceUnavailable.onModuleInit();

      const buffer = Buffer.from('test content');
      await expect(
        serviceUnavailable.uploadFile(buffer, 'test-key', 'image/jpeg'),
      ).rejects.toThrow('MinIO is not available');
    });

    it('should handle upload failure', async () => {
      mockMinioClient.putObject.mockRejectedValue(new Error('Upload failed'));

      const buffer = Buffer.from('test content');
      await expect(
        service.uploadFile(buffer, 'test-key', 'image/jpeg'),
      ).rejects.toThrow('MinIO upload failed: Upload failed');
    });

    it('should upload file with different mime types', async () => {
      const buffer = Buffer.from('test video');

      await service.uploadFile(buffer, 'test-key', 'video/mp4');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        { 'Content-Type': 'video/mp4' },
      );
    });

    it('should handle empty buffer', async () => {
      const buffer = Buffer.from('');

      await service.uploadFile(buffer, 'test-key', 'image/jpeg');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        buffer,
        0,
        expect.anything(),
      );
    });

    it('should handle large buffer', async () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024); // 10MB

      await service.uploadFile(buffer, 'test-key', 'image/jpeg');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        buffer,
        10 * 1024 * 1024,
        expect.anything(),
      );
    });
  });

  describe('getPresignedUrl', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should generate presigned URL with default expiry', async () => {
      const result = await service.getPresignedUrl('test-key');

      expect(result).toBe('https://presigned.url');
      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'vizora-content',
        'test-key',
        3600,
      );
    });

    it('should generate presigned URL with custom expiry', async () => {
      await service.getPresignedUrl('test-key', 7200);

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'vizora-content',
        'test-key',
        7200,
      );
    });

    it('should throw error when MinIO is not available', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection failed'));
      const serviceUnavailable = new StorageService(mockConfigService);
      await serviceUnavailable.onModuleInit();

      await expect(
        serviceUnavailable.getPresignedUrl('test-key'),
      ).rejects.toThrow('MinIO is not available');
    });

    it('should handle presigned URL generation failure', async () => {
      mockMinioClient.presignedGetObject.mockRejectedValue(new Error('Key not found'));

      await expect(
        service.getPresignedUrl('nonexistent-key'),
      ).rejects.toThrow('Failed to generate presigned URL: Key not found');
    });

    it('should handle zero expiry', async () => {
      await service.getPresignedUrl('test-key', 0);

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'vizora-content',
        'test-key',
        0,
      );
    });

    it('should handle very long expiry', async () => {
      await service.getPresignedUrl('test-key', 604800); // 7 days

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'vizora-content',
        'test-key',
        604800,
      );
    });
  });

  describe('deleteFile', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should delete file successfully', async () => {
      await service.deleteFile('test-key');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'vizora-content',
        'test-key',
      );
    });

    it('should throw error when MinIO is not available', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection failed'));
      const serviceUnavailable = new StorageService(mockConfigService);
      await serviceUnavailable.onModuleInit();

      await expect(
        serviceUnavailable.deleteFile('test-key'),
      ).rejects.toThrow('MinIO is not available');
    });

    it('should handle delete failure', async () => {
      mockMinioClient.removeObject.mockRejectedValue(new Error('Delete denied'));

      await expect(
        service.deleteFile('test-key'),
      ).rejects.toThrow('MinIO delete failed: Delete denied');
    });

    it('should handle deleting non-existent file', async () => {
      mockMinioClient.removeObject.mockRejectedValue(new Error('Not Found'));

      await expect(service.deleteFile('nonexistent')).rejects.toThrow('MinIO delete failed');
    });
  });

  describe('fileExists', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return true when file exists', async () => {
      mockMinioClient.statObject.mockResolvedValue({ size: 1024 });

      const result = await service.fileExists('test-key');

      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockMinioClient.statObject.mockRejectedValue(new Error('Not Found'));

      const result = await service.fileExists('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when MinIO is not available', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection failed'));
      const serviceUnavailable = new StorageService(mockConfigService);
      await serviceUnavailable.onModuleInit();

      const result = await serviceUnavailable.fileExists('test-key');

      expect(result).toBe(false);
    });

    it('should return false on unexpected error', async () => {
      mockMinioClient.statObject.mockRejectedValue(new Error('Internal error'));

      const result = await service.fileExists('test-key');

      expect(result).toBe(false);
    });
  });

  describe('getFileMetadata', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return file metadata', async () => {
      const mockDate = new Date('2024-01-01');
      mockMinioClient.statObject.mockResolvedValue({
        size: 1024,
        lastModified: mockDate,
        metaData: { 'content-type': 'image/png' },
      });

      const result = await service.getFileMetadata('test-key');

      expect(result).toEqual({
        size: 1024,
        lastModified: mockDate,
        contentType: 'image/png',
      });
    });

    it('should return null when file does not exist', async () => {
      mockMinioClient.statObject.mockRejectedValue(new Error('Not Found'));

      const result = await service.getFileMetadata('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when MinIO is not available', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection failed'));
      const serviceUnavailable = new StorageService(mockConfigService);
      await serviceUnavailable.onModuleInit();

      const result = await serviceUnavailable.getFileMetadata('test-key');

      expect(result).toBeNull();
    });

    it('should use default content type when not in metadata', async () => {
      mockMinioClient.statObject.mockResolvedValue({
        size: 1024,
        lastModified: new Date(),
        metaData: {},
      });

      const result = await service.getFileMetadata('test-key');

      expect(result?.contentType).toBe('application/octet-stream');
    });

    it('should handle missing metaData field', async () => {
      mockMinioClient.statObject.mockResolvedValue({
        size: 1024,
        lastModified: new Date(),
      });

      const result = await service.getFileMetadata('test-key');

      expect(result?.contentType).toBe('application/octet-stream');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when MinIO is available', async () => {
      await service.onModuleInit();

      const result = await service.healthCheck();

      expect(result).toEqual({
        healthy: true,
        bucket: 'vizora-content',
      });
    });

    it('should return unhealthy when MinIO is not available', async () => {
      // Don't initialize - MinIO not available
      const result = await service.healthCheck();

      expect(result).toEqual({
        healthy: false,
        bucket: 'vizora-content',
        error: 'MinIO client not available',
      });
    });

    it('should return unhealthy when bucket check fails', async () => {
      await service.onModuleInit();
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection lost'));

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Connection lost');
    });

    it('should return unhealthy when bucket does not exist', async () => {
      await service.onModuleInit();
      mockMinioClient.bucketExists.mockResolvedValue(false);

      const result = await service.healthCheck();

      expect(result).toEqual({
        healthy: false,
        bucket: 'vizora-content',
        error: 'Bucket does not exist',
      });
    });
  });

  describe('listObjects', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should list objects with prefix', async () => {
      const mockStream = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'data') {
            callback({ name: 'org-123/file1.jpg' });
            callback({ name: 'org-123/file2.jpg' });
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        }),
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      const result = await service.listObjects('org-123/');

      expect(result).toEqual(['org-123/file1.jpg', 'org-123/file2.jpg']);
    });

    it('should respect maxKeys parameter', async () => {
      const callbacks: Record<string, Function> = {};
      let destroyed = false;
      const mockStream = {
        on: jest.fn((event: string, callback: Function) => {
          callbacks[event] = callback;
          return mockStream;
        }),
        destroy: jest.fn(() => {
          destroyed = true;
          // When destroy is called, fire the close callback
          if (callbacks['close']) {
            callbacks['close']();
          }
        }),
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      // Start the listObjects call (it returns a promise)
      const resultPromise = service.listObjects('prefix/', 5);

      // Now simulate data events one at a time; stop when stream is destroyed
      for (let i = 0; i < 10 && !destroyed; i++) {
        callbacks['data']({ name: `file${i}.jpg` });
      }
      // If not destroyed by maxKeys, fire end
      if (!destroyed && callbacks['end']) {
        callbacks['end']();
      }

      const result = await resultPromise;
      expect(result.length).toBe(5);
    });

    it('should return empty array when MinIO is not available', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection failed'));
      const serviceUnavailable = new StorageService(mockConfigService);
      await serviceUnavailable.onModuleInit();

      const result = await serviceUnavailable.listObjects('prefix/');

      expect(result).toEqual([]);
    });

    it('should handle stream error', async () => {
      const mockStream = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'error') {
            callback(new Error('Stream error'));
          }
          return mockStream;
        }),
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      await expect(service.listObjects('prefix/')).rejects.toThrow('Stream error');
    });

    it('should handle objects without name', async () => {
      const mockStream = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'data') {
            callback({ name: 'file1.jpg' });
            callback({}); // Object without name
            callback({ name: 'file2.jpg' });
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        }),
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      const result = await service.listObjects('prefix/');

      expect(result).toEqual(['file1.jpg', 'file2.jpg']);
    });
  });

  describe('copyFile', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should copy file successfully', async () => {
      await service.copyFile('source-key', 'dest-key');

      expect(mockMinioClient.copyObject).toHaveBeenCalledWith(
        'vizora-content',
        'dest-key',
        '/vizora-content/source-key',
        expect.anything(),
      );
    });

    it('should throw error when MinIO is not available', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection failed'));
      const serviceUnavailable = new StorageService(mockConfigService);
      await serviceUnavailable.onModuleInit();

      await expect(
        serviceUnavailable.copyFile('source', 'dest'),
      ).rejects.toThrow('MinIO is not available');
    });

    it('should handle copy failure', async () => {
      mockMinioClient.copyObject.mockRejectedValue(new Error('Source not found'));

      await expect(
        service.copyFile('nonexistent', 'dest'),
      ).rejects.toThrow('MinIO copy failed: Source not found');
    });
  });

  describe('getBucket', () => {
    it('should return the configured bucket name', () => {
      expect(service.getBucket()).toBe('vizora-content');
    });

    it('should return custom bucket name', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MINIO_BUCKET') return 'custom-bucket';
        return defaultConfig[key];
      });

      const serviceWithCustomBucket = new StorageService(mockConfigService);
      expect(serviceWithCustomBucket.getBucket()).toBe('custom-bucket');
    });
  });

  describe('error handling edge cases', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should handle unknown error types in upload', async () => {
      mockMinioClient.putObject.mockRejectedValue('string error');

      const buffer = Buffer.from('test');
      await expect(
        service.uploadFile(buffer, 'key', 'image/jpeg'),
      ).rejects.toThrow('MinIO upload failed: Unknown error');
    });

    it('should handle unknown error types in presigned URL', async () => {
      mockMinioClient.presignedGetObject.mockRejectedValue(null);

      await expect(
        service.getPresignedUrl('key'),
      ).rejects.toThrow('Failed to generate presigned URL: Unknown error');
    });

    it('should handle unknown error types in delete', async () => {
      mockMinioClient.removeObject.mockRejectedValue(undefined);

      await expect(
        service.deleteFile('key'),
      ).rejects.toThrow('MinIO delete failed: Unknown error');
    });

    it('should handle unknown error types in copy', async () => {
      mockMinioClient.copyObject.mockRejectedValue(42);

      await expect(
        service.copyFile('source', 'dest'),
      ).rejects.toThrow('MinIO copy failed: Unknown error');
    });
  });
});
