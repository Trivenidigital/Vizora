// Mock isomorphic-dompurify before importing services
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DeviceContentController } from './device-content.controller';
import { ContentService } from './content.service';
import { StorageService } from '../storage/storage.service';
import { DatabaseService } from '../database/database.service';
import { createHash } from 'node:crypto';
import { Readable, Writable } from 'node:stream';

describe('DeviceContentController', () => {
  let controller: DeviceContentController;
  let mockContentService: jest.Mocked<ContentService>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockDatabaseService: any;

  const organizationId = 'org-123';
  const deviceId = 'device-456';
  const contentId = 'content-789';
  const objectKey = `${organizationId}/uploads/test-image.jpg`;

  const hashToken = (token: string) =>
    createHash('sha256').update(token).digest('hex');

  const createDeferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };

  const validDevicePayload = {
    sub: deviceId,
    deviceIdentifier: 'DEVICE-001',
    organizationId,
    type: 'device' as const,
  };

  const mockContent = {
    id: contentId,
    name: 'Test Image',
    type: 'image',
    url: `minio://${objectKey}`,
    mimeType: 'image/jpeg',
    organizationId,
    status: 'active',
  };

  beforeEach(async () => {
    mockContentService = {
      findByIdForDevice: jest.fn(),
    } as any;

    mockStorageService = {
      isMinioAvailable: jest.fn().mockReturnValue(true),
      getObject: jest.fn(),
      getObjectRange: jest.fn(),
      getFileMetadata: jest.fn(),
    } as any;

    mockJwtService = {
      verify: jest.fn(),
    } as any;

    mockDatabaseService = {
      display: {
        findUnique: jest.fn().mockResolvedValue({
          id: deviceId,
          organizationId,
          isDisabled: false,
          jwtToken: hashToken('valid-device-token'),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviceContentController],
      providers: [
        { provide: ContentService, useValue: mockContentService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    controller = module.get<DeviceContentController>(DeviceContentController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('serveFile', () => {
    const createMockRequest = (token?: string, queryToken?: string) => {
      const req: any = {
        headers: {},
        query: {},
        originalUrl: `/api/v1/device-content/${contentId}/file`,
      };
      if (token) {
        req.headers.authorization = `Bearer ${token}`;
      }
      if (queryToken) {
        req.query.token = queryToken;
      }
      const presentedToken = token ?? queryToken;
      if (presentedToken) {
        mockDatabaseService.display.findUnique.mockResolvedValue({
          id: deviceId,
          organizationId,
          isDisabled: false,
          jwtToken: hashToken(presentedToken),
        });
      }
      return req;
    };

    const createMockResponse = () => {
      const chunks: Buffer[] = [];
      let res: any;
      res = new Writable({
        write(chunk, _encoding, callback) {
          res.headersSent = true;
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });
      res.statusCode = 200;
      res.headersSent = false;
      res.set = jest.fn().mockReturnValue(res);
      res.status = jest.fn((statusCode: number) => {
        res.statusCode = statusCode;
        return res;
      });
      res.redirect = jest.fn();
      res.removeHeader = jest.fn();
      const destroy = res.destroy.bind(res);
      res.destroy = jest.fn((error?: Error) => destroy(error));
      res.getBody = () => Buffer.concat(chunks);
      return res;
    };

    it('should serve content file with valid device JWT from Authorization header', async () => {
      const req = createMockRequest('valid-device-token');
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);

      const buffer = Buffer.from('file-content');
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: buffer.length,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });
      mockStorageService.getObject.mockResolvedValue(Readable.from([buffer]));

      await controller.serveFile(contentId, req, res);

      expect(mockContentService.findByIdForDevice).toHaveBeenCalledWith(
        contentId,
        validDevicePayload.organizationId,
      );
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-device-token', {
        secret: process.env.DEVICE_JWT_SECRET,
        algorithms: ['HS256'],
      });
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'image/jpeg',
          'Accept-Ranges': 'bytes',
          'Content-Length': String(buffer.length),
          'Cache-Control': 'private, no-cache',
          ETag: expect.stringMatching(/^W\/".+"$/),
          'Last-Modified': 'Sun, 31 May 2026 00:00:00 GMT',
        }),
      );
      expect(mockStorageService.getObject).toHaveBeenCalledWith(objectKey);
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
      expect(res.getBody().toString()).toBe('file-content');
    });

    it('should reject disabled display tokens before serving content', async () => {
      const req = createMockRequest('valid-device-token');
      const res = createMockResponse();
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        id: deviceId,
        organizationId,
        isDisabled: true,
        jwtToken: hashToken('valid-device-token'),
      });

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(UnauthorizedException);

      expect(mockContentService.findByIdForDevice).not.toHaveBeenCalled();
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
    });

    it('should reject a signed device JWT that is not the current stored token', async () => {
      const req = createMockRequest('stale-device-token');
      const res = createMockResponse();
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        id: deviceId,
        organizationId,
        isDisabled: false,
        jwtToken: hashToken('current-device-token'),
      });

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockContentService.findByIdForDevice).not.toHaveBeenCalled();
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
    });

    it('should reject a signed device JWT when the display has no stored token hash', async () => {
      const req = createMockRequest('valid-device-token');
      const res = createMockResponse();
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        id: deviceId,
        organizationId,
        isDisabled: false,
        jwtToken: null,
      });

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockContentService.findByIdForDevice).not.toHaveBeenCalled();
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
    });

    it('should reject a signed device JWT when the stored token hash is malformed', async () => {
      const req = createMockRequest('valid-device-token');
      const res = createMockResponse();
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        id: deviceId,
        organizationId,
        isDisabled: false,
        jwtToken: 'legacy-plaintext-token',
      });

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockContentService.findByIdForDevice).not.toHaveBeenCalled();
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
    });

    it('should serve content file with valid device JWT from query parameter', async () => {
      const req = createMockRequest(undefined, 'valid-query-token');
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);

      const buffer = Buffer.from('file-content');
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: buffer.length,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });
      mockStorageService.getObject.mockResolvedValue(Readable.from([buffer]));

      await controller.serveFile(contentId, req, res);

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-query-token', {
        secret: process.env.DEVICE_JWT_SECRET,
        algorithms: ['HS256'],
      });
      expect(res.getBody().toString()).toBe('file-content');
    });

    it('should return 401 when no token is provided', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return 401 when token is invalid', async () => {
      const req = createMockRequest('invalid-token');
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return 401 when token type is not device', async () => {
      const req = createMockRequest('user-token');
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue({
        ...validDevicePayload,
        type: 'user',
      });

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return 401 when a signed device token is missing organizationId', async () => {
      const req = createMockRequest('legacy-device-token');
      const res = createMockResponse();

      mockJwtService.verify.mockReturnValue({
        sub: deviceId,
        deviceIdentifier: 'DEVICE-001',
        type: 'device',
      });

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockContentService.findByIdForDevice).not.toHaveBeenCalled();
    });

    it('should return 404 when content belongs to a different organization', async () => {
      // After the IDOR hardening, the org filter lives in the query
      // (findByIdForDevice). A device with the wrong org id therefore
      // gets a uniform NotFoundException — the service never loads
      // the other org's row, so there is no record on which to
      // distinguish Forbidden vs NotFound (which is intentional).
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(null);
      mockJwtService.verify.mockReturnValue(validDevicePayload);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockContentService.findByIdForDevice).toHaveBeenCalledWith(
        contentId,
        validDevicePayload.organizationId,
      );
    });

    it('should return 404 when a MinIO content row points outside the device organization prefix', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue({
        ...mockContent,
        url: 'minio://other-org/uploads/test-image.jpg',
      } as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockStorageService.getFileMetadata).not.toHaveBeenCalled();
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
    });

    it('should return 404 when content does not exist', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockContentService.findByIdForDevice.mockResolvedValue(null);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return 404 when content has no URL', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockContentService.findByIdForDevice.mockResolvedValue({
        ...mockContent,
        url: null,
      } as any);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should redirect for non-MinIO URLs', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      const externalContent = {
        ...mockContent,
        url: 'https://cdn.example.com/image.jpg',
      };
      mockContentService.findByIdForDevice.mockResolvedValue(externalContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);

      await controller.serveFile(contentId, req, res);

      expect(res.redirect).toHaveBeenCalledWith('https://cdn.example.com/image.jpg');
      expect(res.set).toHaveBeenCalledWith(
        'Cross-Origin-Resource-Policy',
        'cross-origin',
      );
    });

    it('should throw BadRequestException when MinIO is unavailable', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.isMinioAvailable.mockReturnValue(false);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use application/octet-stream when mimeType is not set', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      const contentNoMime = { ...mockContent, mimeType: null };
      mockContentService.findByIdForDevice.mockResolvedValue(contentNoMime as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);

      const buffer = Buffer.from('binary-data');
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: buffer.length,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'application/octet-stream',
      });
      mockStorageService.getObject.mockResolvedValue(Readable.from([buffer]));

      await controller.serveFile(contentId, req, res);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/octet-stream',
        }),
      );
    });

    it('should serve a requested byte range with 206 status', async () => {
      const req = createMockRequest('valid-device-token');
      req.headers.range = 'bytes=5-8';
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });
      mockStorageService.getObjectRange.mockResolvedValue(Readable.from(['rang']));

      await controller.serveFile(contentId, req, res);

      expect(res.status).toHaveBeenCalledWith(206);
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Length': '4',
          'Content-Range': 'bytes 5-8/12',
          'Cache-Control': 'private, no-cache',
          'Last-Modified': 'Sun, 31 May 2026 00:00:00 GMT',
        }),
      );
      expect(res.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          ETag: expect.any(String),
        }),
      );
      expect(mockStorageService.getObjectRange).toHaveBeenCalledWith(
        objectKey,
        5,
        4,
      );
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
      expect(res.getBody().toString()).toBe('rang');
    });

    it('should reuse auth, content, and object metadata during a range-request burst', async () => {
      const now = 1_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const firstReq = createMockRequest('valid-device-token');
      firstReq.headers.range = 'bytes=0-3';
      const firstRes = createMockResponse();
      const secondReq = createMockRequest('valid-device-token');
      secondReq.headers.range = 'bytes=4-7';
      const secondRes = createMockResponse();

      mockJwtService.verify.mockReturnValue({
        ...validDevicePayload,
        exp: Math.floor((now + 60_000) / 1000),
      } as any);
      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });
      mockStorageService.getObjectRange
        .mockResolvedValueOnce(Readable.from(['abcd']))
        .mockResolvedValueOnce(Readable.from(['efgh']));

      await controller.serveFile(contentId, firstReq, firstRes);
      await controller.serveFile(contentId, secondReq, secondRes);

      expect(mockJwtService.verify).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.display.findUnique).toHaveBeenCalledTimes(1);
      expect(mockContentService.findByIdForDevice).toHaveBeenCalledTimes(1);
      expect(mockStorageService.getFileMetadata).toHaveBeenCalledTimes(1);
      expect(mockStorageService.getObjectRange).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getObjectRange).toHaveBeenNthCalledWith(1, objectKey, 0, 4);
      expect(mockStorageService.getObjectRange).toHaveBeenNthCalledWith(2, objectKey, 4, 4);
      expect(firstRes.getBody().toString()).toBe('abcd');
      expect(secondRes.getBody().toString()).toBe('efgh');
    });

    it('should coalesce concurrent auth, content, and metadata loads during a range-request burst', async () => {
      const now = 1_500_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const displayDeferred = createDeferred<any>();
      const contentDeferred = createDeferred<any>();
      const metadataDeferred = createDeferred<any>();

      const firstReq = createMockRequest('valid-device-token');
      firstReq.headers.range = 'bytes=0-3';
      const firstRes = createMockResponse();
      const secondReq = createMockRequest('valid-device-token');
      secondReq.headers.range = 'bytes=4-7';
      const secondRes = createMockResponse();

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockDatabaseService.display.findUnique.mockReturnValue(displayDeferred.promise);
      mockContentService.findByIdForDevice.mockReturnValue(contentDeferred.promise);
      mockStorageService.getFileMetadata.mockReturnValue(metadataDeferred.promise);
      mockStorageService.getObjectRange
        .mockResolvedValueOnce(Readable.from(['abcd']))
        .mockResolvedValueOnce(Readable.from(['efgh']));

      const firstPromise = controller.serveFile(contentId, firstReq, firstRes);
      const secondPromise = controller.serveFile(contentId, secondReq, secondRes);

      await Promise.resolve();
      expect(mockJwtService.verify).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.display.findUnique).toHaveBeenCalledTimes(1);

      displayDeferred.resolve({
        id: deviceId,
        organizationId,
        isDisabled: false,
        jwtToken: hashToken('valid-device-token'),
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(mockContentService.findByIdForDevice).toHaveBeenCalledTimes(1);

      contentDeferred.resolve(mockContent);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(mockStorageService.getFileMetadata).toHaveBeenCalledTimes(1);

      metadataDeferred.resolve({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });

      await Promise.all([firstPromise, secondPromise]);

      expect(mockStorageService.getObjectRange).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getObjectRange).toHaveBeenNthCalledWith(1, objectKey, 0, 4);
      expect(mockStorageService.getObjectRange).toHaveBeenNthCalledWith(2, objectKey, 4, 4);
      expect(firstRes.getBody().toString()).toBe('abcd');
      expect(secondRes.getBody().toString()).toBe('efgh');
    });

    it('should recheck the current display token hash after the auth cache expires', async () => {
      const now = 2_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      const req = createMockRequest('valid-device-token');
      req.headers.range = 'bytes=0-3';
      const firstRes = createMockResponse();
      const secondRes = createMockResponse();

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce({
          id: deviceId,
          organizationId,
          isDisabled: false,
          jwtToken: hashToken('valid-device-token'),
        })
        .mockResolvedValueOnce({
          id: deviceId,
          organizationId,
          isDisabled: false,
          jwtToken: hashToken('rotated-device-token'),
        });
      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });
      mockStorageService.getObjectRange.mockResolvedValue(Readable.from(['abcd']));

      await controller.serveFile(contentId, req, firstRes);

      nowSpy.mockReturnValue(now + 5_001);
      await expect(controller.serveFile(contentId, req, secondRes)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockJwtService.verify).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.display.findUnique).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getObjectRange).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cached content and metadata and retry once when a cached object key is stale', async () => {
      const now = 3_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const firstReq = createMockRequest('valid-device-token');
      firstReq.headers.range = 'bytes=0-3';
      const firstRes = createMockResponse();
      const secondReq = createMockRequest('valid-device-token');
      secondReq.headers.range = 'bytes=0-2';
      const secondRes = createMockResponse();
      const replacementObjectKey = `${organizationId}/uploads/replacement-image.jpg`;

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockContentService.findByIdForDevice
        .mockResolvedValueOnce(mockContent as any)
        .mockResolvedValueOnce({
          ...mockContent,
          url: `minio://${replacementObjectKey}`,
        } as any);
      mockStorageService.getFileMetadata
        .mockResolvedValueOnce({
          size: 12,
          lastModified: new Date('2026-05-31T00:00:00.000Z'),
          contentType: 'image/jpeg',
        })
        .mockResolvedValueOnce({
          size: 9,
          lastModified: new Date('2026-05-31T00:00:10.000Z'),
          contentType: 'image/jpeg',
        });
      mockStorageService.getObjectRange
        .mockResolvedValueOnce(Readable.from(['old!']))
        .mockRejectedValueOnce(new Error('Not Found'))
        .mockResolvedValueOnce(Readable.from(['new']));

      await controller.serveFile(contentId, firstReq, firstRes);
      await controller.serveFile(contentId, secondReq, secondRes);

      expect(mockContentService.findByIdForDevice).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getFileMetadata).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getObjectRange).toHaveBeenNthCalledWith(1, objectKey, 0, 4);
      expect(mockStorageService.getObjectRange).toHaveBeenNthCalledWith(2, objectKey, 0, 3);
      expect(mockStorageService.getObjectRange).toHaveBeenNthCalledWith(3, replacementObjectKey, 0, 3);
      expect(secondRes.status).toHaveBeenCalledWith(206);
      expect(secondRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Length': '3',
          'Content-Range': 'bytes 0-2/9',
          'Cache-Control': 'private, no-cache',
        }),
      );
      expect(firstRes.getBody().toString()).toBe('old!');
      expect(secondRes.getBody().toString()).toBe('new');
    });

    it('should let one stale cached object miss refresh a concurrent range burst', async () => {
      const now = 3_500_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const firstReq = createMockRequest('valid-device-token');
      firstReq.headers.range = 'bytes=0-3';
      const firstRes = createMockResponse();
      const secondReq = createMockRequest('valid-device-token');
      secondReq.headers.range = 'bytes=0-2';
      const secondRes = createMockResponse();
      const thirdReq = createMockRequest('valid-device-token');
      thirdReq.headers.range = 'bytes=3-5';
      const thirdRes = createMockResponse();
      const replacementObjectKey = `${organizationId}/uploads/replacement-image.jpg`;

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockContentService.findByIdForDevice
        .mockResolvedValueOnce(mockContent as any)
        .mockResolvedValueOnce({
          ...mockContent,
          url: `minio://${replacementObjectKey}`,
        } as any);
      mockStorageService.getFileMetadata
        .mockResolvedValueOnce({
          size: 12,
          lastModified: new Date('2026-05-31T00:00:00.000Z'),
          contentType: 'image/jpeg',
        })
        .mockResolvedValueOnce({
          size: 9,
          lastModified: new Date('2026-05-31T00:00:10.000Z'),
          contentType: 'image/jpeg',
        });
      mockStorageService.getObjectRange
        .mockResolvedValueOnce(Readable.from(['old!']))
        .mockRejectedValueOnce(new Error('Not Found'))
        .mockResolvedValueOnce(Readable.from(['new']))
        .mockResolvedValueOnce(Readable.from(['est']));

      await controller.serveFile(contentId, firstReq, firstRes);
      await Promise.all([
        controller.serveFile(contentId, secondReq, secondRes),
        controller.serveFile(contentId, thirdReq, thirdRes),
      ]);

      expect(mockContentService.findByIdForDevice).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getFileMetadata).toHaveBeenCalledTimes(2);
      const oldObjectCalls = mockStorageService.getObjectRange.mock.calls.filter(
        ([calledObjectKey]) => calledObjectKey === objectKey,
      );
      const replacementObjectCalls = mockStorageService.getObjectRange.mock.calls.filter(
        ([calledObjectKey]) => calledObjectKey === replacementObjectKey,
      );
      expect(oldObjectCalls).toHaveLength(2);
      expect(replacementObjectCalls).toHaveLength(2);
      expect(secondRes.getBody().toString()).toBe('new');
      expect(thirdRes.getBody().toString()).toBe('est');
    });

    it('should evict cached content and retry fresh when cached object metadata disappears', async () => {
      const now = 3_750_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const firstReq = createMockRequest('valid-device-token');
      firstReq.headers.range = 'bytes=0-2';
      const firstRes = createMockResponse();
      const secondReq = createMockRequest('valid-device-token');
      secondReq.headers.range = 'bytes=0-2';
      const secondRes = createMockResponse();
      const replacementObjectKey = `${organizationId}/uploads/replacement-image.jpg`;

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockContentService.findByIdForDevice
        .mockResolvedValueOnce(mockContent as any)
        .mockResolvedValueOnce({
          ...mockContent,
          url: `minio://${replacementObjectKey}`,
        } as any);
      mockStorageService.getFileMetadata
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          size: 9,
          lastModified: new Date('2026-05-31T00:00:10.000Z'),
          contentType: 'image/jpeg',
        });
      mockStorageService.getObjectRange.mockResolvedValueOnce(Readable.from(['new']));

      await expect(controller.serveFile(contentId, firstReq, firstRes)).rejects.toThrow(
        NotFoundException,
      );
      await controller.serveFile(contentId, secondReq, secondRes);

      expect(mockContentService.findByIdForDevice).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getFileMetadata).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getObjectRange).toHaveBeenCalledWith(
        replacementObjectKey,
        0,
        3,
      );
      expect(secondRes.getBody().toString()).toBe('new');
    });

    it('should retry in the same request when cached-row metadata is missing after a storage outage', async () => {
      const now = 3_875_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const outageReq = createMockRequest('valid-device-token');
      outageReq.headers.range = 'bytes=0-2';
      const outageRes = createMockResponse();
      const retryReq = createMockRequest('valid-device-token');
      retryReq.headers.range = 'bytes=0-2';
      const retryRes = createMockResponse();
      const replacementObjectKey = `${organizationId}/uploads/replacement-image.jpg`;

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockContentService.findByIdForDevice
        .mockResolvedValueOnce(mockContent as any)
        .mockResolvedValueOnce({
          ...mockContent,
          url: `minio://${replacementObjectKey}`,
        } as any);
      mockStorageService.isMinioAvailable
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      mockStorageService.getFileMetadata
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          size: 9,
          lastModified: new Date('2026-05-31T00:00:10.000Z'),
          contentType: 'image/jpeg',
        });
      mockStorageService.getObjectRange.mockResolvedValueOnce(Readable.from(['new']));

      await expect(controller.serveFile(contentId, outageReq, outageRes)).rejects.toThrow(
        BadRequestException,
      );
      await controller.serveFile(contentId, retryReq, retryRes);

      expect(mockContentService.findByIdForDevice).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getFileMetadata).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getObjectRange).toHaveBeenCalledWith(
        replacementObjectKey,
        0,
        3,
      );
      expect(retryRes.getBody().toString()).toBe('new');
    });

    it('should serve suffix byte ranges', async () => {
      const req = createMockRequest('valid-device-token');
      req.headers.range = 'bytes=-4';
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });
      mockStorageService.getObjectRange.mockResolvedValue(Readable.from(['tail']));

      await controller.serveFile(contentId, req, res);

      expect(res.status).toHaveBeenCalledWith(206);
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Length': '4',
          'Content-Range': 'bytes 8-11/12',
        }),
      );
      expect(mockStorageService.getObjectRange).toHaveBeenCalledWith(
        objectKey,
        8,
        4,
      );
    });

    it('should return 416 for an unsatisfiable byte range', async () => {
      const req = createMockRequest('valid-device-token');
      req.headers.range = 'bytes=99-120';
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });

      await controller.serveFile(contentId, req, res);

      expect(res.status).toHaveBeenCalledWith(416);
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Range': 'bytes */12',
          'Cache-Control': 'no-store',
        }),
      );
      expect(res.set).not.toHaveBeenCalledWith(expect.objectContaining({
        'Cache-Control': 'private, no-cache',
      }));
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
    });

    it('should reject unsupported multi-range headers without opening a stream', async () => {
      const req = createMockRequest('valid-device-token');
      req.headers.range = 'bytes=0-2,5-8';
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });

      await controller.serveFile(contentId, req, res);

      expect(res.status).toHaveBeenCalledWith(416);
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Accept-Ranges': 'bytes',
          'Content-Range': 'bytes */12',
          'Cache-Control': 'no-store',
        }),
      );
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
      expect(res.getBody().toString()).toBe('');
    });

    it('should return 304 for a matching If-None-Match before opening MinIO stream', async () => {
      const lastModified = new Date('2026-05-31T00:00:00.000Z');
      const etag = `W/"${createHash('sha256')
        .update(`${objectKey}:12:${lastModified.getTime()}`)
        .digest('base64url')}"`;
      const req = createMockRequest('valid-device-token');
      req.headers['if-none-match'] = etag;
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified,
        contentType: 'image/jpeg',
      });

      await controller.serveFile(contentId, req, res);

      expect(res.status).toHaveBeenCalledWith(304);
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ETag: etag,
          'Last-Modified': 'Sun, 31 May 2026 00:00:00 GMT',
          'Cache-Control': 'private, no-cache',
          'Accept-Ranges': 'bytes',
        }),
      );
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
      expect(res.getBody().toString()).toBe('');
    });

    it('should return 304 for an unchanged If-Modified-Since before opening MinIO stream', async () => {
      const req = createMockRequest('valid-device-token');
      req.headers['if-modified-since'] = 'Sun, 31 May 2026 00:00:30 GMT';
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });

      await controller.serveFile(contentId, req, res);

      expect(res.status).toHaveBeenCalledWith(304);
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Last-Modified': 'Sun, 31 May 2026 00:00:00 GMT',
          'Cache-Control': 'private, no-cache',
        }),
      );
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
    });

    it('should return 304 from cached validators without opening a second MinIO stream', async () => {
      const now = 3_750_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const lastModified = new Date('2026-05-31T00:00:00.000Z');
      const etag = `W/"${createHash('sha256')
        .update(`${objectKey}:12:${lastModified.getTime()}`)
        .digest('base64url')}"`;
      const firstReq = createMockRequest('valid-device-token');
      const firstRes = createMockResponse();
      const secondReq = createMockRequest('valid-device-token');
      secondReq.headers['if-none-match'] = etag;
      const secondRes = createMockResponse();

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified,
        contentType: 'image/jpeg',
      });
      mockStorageService.getObject.mockResolvedValue(Readable.from(['first-stream']));

      await controller.serveFile(contentId, firstReq, firstRes);
      await controller.serveFile(contentId, secondReq, secondRes);

      expect(secondRes.status).toHaveBeenCalledWith(304);
      expect(mockContentService.findByIdForDevice).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getFileMetadata).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getObject).toHaveBeenCalledTimes(1);
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
      expect(secondRes.getBody().toString()).toBe('');
    });

    it('should reject oversized media discovered during cached metadata revalidation', async () => {
      const now = 3_850_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const lastModified = new Date('2026-05-31T00:00:00.000Z');
      const etag = `W/"${createHash('sha256')
        .update(`${objectKey}:12:${lastModified.getTime()}`)
        .digest('base64url')}"`;
      const firstReq = createMockRequest('valid-device-token');
      const firstRes = createMockResponse();
      const secondReq = createMockRequest('valid-device-token');
      secondReq.headers['if-none-match'] = etag;
      const secondRes = createMockResponse();
      const thirdReq = createMockRequest('valid-device-token');
      const thirdRes = createMockResponse();
      const oversizedMetadata = {
        size: 100 * 1024 * 1024 + 1,
        lastModified,
        contentType: 'image/jpeg',
      };

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockStorageService.getFileMetadata
        .mockResolvedValueOnce({
          size: 12,
          lastModified,
          contentType: 'image/jpeg',
        })
        .mockResolvedValue(oversizedMetadata);
      mockStorageService.getObject.mockResolvedValue(Readable.from(['first-stream']));

      await controller.serveFile(contentId, firstReq, firstRes);
      await expect(controller.serveFile(contentId, secondReq, secondRes)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.serveFile(contentId, thirdReq, thirdRes)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockStorageService.getObject).toHaveBeenCalledTimes(1);
      expect(secondRes.status).not.toHaveBeenCalledWith(304);
    });

    it('should return 304 for a satisfiable range request with a matching validator', async () => {
      const lastModified = new Date('2026-05-31T00:00:00.000Z');
      const etag = `W/"${createHash('sha256')
        .update(`${objectKey}:12:${lastModified.getTime()}`)
        .digest('base64url')}"`;
      const req = createMockRequest('valid-device-token');
      req.headers.range = 'bytes=0-3';
      req.headers['if-none-match'] = etag;
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified,
        contentType: 'image/jpeg',
      });

      await controller.serveFile(contentId, req, res);

      expect(res.status).toHaveBeenCalledWith(304);
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
    });

    it('should refresh stale cached objects instead of returning 304 from cached validators', async () => {
      const now = 4_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const firstReq = createMockRequest('valid-device-token');
      const firstRes = createMockResponse();
      const firstLastModified = new Date('2026-05-31T00:00:00.000Z');
      const firstEtag = `W/"${createHash('sha256')
        .update(`${objectKey}:12:${firstLastModified.getTime()}`)
        .digest('base64url')}"`;
      const secondReq = createMockRequest('valid-device-token');
      secondReq.headers['if-none-match'] = firstEtag;
      const secondRes = createMockResponse();
      const replacementObjectKey = `${organizationId}/uploads/replacement-image.jpg`;

      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockContentService.findByIdForDevice
        .mockResolvedValueOnce(mockContent as any)
        .mockResolvedValueOnce({
          ...mockContent,
          url: `minio://${replacementObjectKey}`,
        } as any);
      mockStorageService.getFileMetadata
        .mockResolvedValueOnce({
          size: 12,
          lastModified: firstLastModified,
          contentType: 'image/jpeg',
        })
        .mockResolvedValueOnce({
          size: 9,
          lastModified: new Date('2026-05-31T00:00:10.000Z'),
          contentType: 'image/jpeg',
        });
      mockStorageService.getObject
        .mockResolvedValueOnce(Readable.from(['old']))
        .mockResolvedValueOnce(Readable.from(['new']));

      await controller.serveFile(contentId, firstReq, firstRes);
      await controller.serveFile(contentId, secondReq, secondRes);

      expect(secondRes.status).not.toHaveBeenCalledWith(304);
      expect(mockContentService.findByIdForDevice).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getObject).toHaveBeenNthCalledWith(1, objectKey);
      expect(mockStorageService.getObject).toHaveBeenNthCalledWith(2, replacementObjectKey);
      expect(secondRes.getBody().toString()).toBe('new');
    });

    it('should clear media headers and return 500 when streaming fails before headers are sent', async () => {
      const req = createMockRequest('valid-device-token');
      const res = createMockResponse();

      const failingStream = new Readable({
        read() {
          this.destroy(new Error('MinIO stream failed'));
        },
      });

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });
      mockStorageService.getObject.mockResolvedValue(failingStream);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(res.removeHeader).toHaveBeenCalledWith('Content-Type');
      expect(res.removeHeader).toHaveBeenCalledWith('Content-Length');
      expect(res.removeHeader).toHaveBeenCalledWith('Cache-Control');
      expect(res.removeHeader).toHaveBeenCalledWith('ETag');
      expect(res.removeHeader).toHaveBeenCalledWith('Last-Modified');
      expect(res.removeHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy');
    });

    it('should log request context when streaming fails after media headers are sent', async () => {
      const req = createMockRequest('valid-device-token') as any;
      req.requestId = 'req-stream-123';
      const res = createMockResponse();
      const loggerErrorSpy = jest
        .spyOn((controller as any).logger, 'error')
        .mockImplementation();

      const failingStream = Readable.from((async function* () {
        yield Buffer.from('partial');
        throw new Error('post-header stream failed');
      })());

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });
      mockStorageService.getObject.mockResolvedValue(failingStream);

      await controller.serveFile(contentId, req, res);

      expect(res.getBody().toString()).toBe('partial');
      expect(res.headersSent).toBe(true);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[req-stream-123] Failed to stream device content content-789 at /api/v1/device-content/content-789/file: post-header stream failed (status=200)',
        ),
      );
      expect(res.destroy).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should not set media headers when full-object stream acquisition fails', async () => {
      const req = createMockRequest('valid-device-token');
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });
      mockStorageService.getObject.mockRejectedValue(new Error('MinIO read failed'));

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        'MinIO read failed',
      );
      expect(res.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'image/jpeg',
        }),
      );
      expect(res.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Length': expect.any(String),
        }),
      );
    });

    it('should not set range headers when range stream acquisition fails', async () => {
      const req = createMockRequest('valid-device-token');
      req.headers.range = 'bytes=5-8';
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 12,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'image/jpeg',
      });
      mockStorageService.getObjectRange.mockRejectedValue(new Error('MinIO range failed'));

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        'MinIO range failed',
      );
      expect(res.status).not.toHaveBeenCalledWith(206);
      expect(res.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Range': 'bytes 5-8/12',
        }),
      );
    });

    it('should return 404 when MinIO metadata is missing', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue(null);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
    });

    it('should reject content over the maximum file size before opening a stream', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      mockContentService.findByIdForDevice.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);
      mockStorageService.getFileMetadata.mockResolvedValue({
        size: 100 * 1024 * 1024 + 1,
        lastModified: new Date('2026-05-31T00:00:00.000Z'),
        contentType: 'video/mp4',
      });

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
    });
  });
});
