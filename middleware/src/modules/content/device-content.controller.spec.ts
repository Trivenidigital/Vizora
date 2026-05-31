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

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('serveFile', () => {
    const createMockRequest = (token?: string, queryToken?: string) => {
      const req: any = {
        headers: {},
        query: {},
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
      const res: any = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });
      res.set = jest.fn().mockReturnValue(res);
      res.status = jest.fn().mockReturnValue(res);
      res.redirect = jest.fn();
      res.removeHeader = jest.fn();
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
      expect(res.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          'Cache-Control': 'private, no-store',
        }),
      );
      expect(mockStorageService.getObject).not.toHaveBeenCalled();
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
    });

    it('should ignore unsupported multi-range headers and stream the full object', async () => {
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
      mockStorageService.getObject.mockResolvedValue(Readable.from(['full-response']));

      await controller.serveFile(contentId, req, res);

      expect(res.status).not.toHaveBeenCalledWith(416);
      expect(mockStorageService.getObjectRange).not.toHaveBeenCalled();
      expect(mockStorageService.getObject).toHaveBeenCalledWith(objectKey);
      expect(res.getBody().toString()).toBe('full-response');
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
      expect(res.removeHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy');
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
