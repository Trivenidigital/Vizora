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
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DeviceContentController } from './device-content.controller';
import { ContentService } from './content.service';
import { StorageService } from '../storage/storage.service';

describe('DeviceContentController', () => {
  let controller: DeviceContentController;
  let mockContentService: jest.Mocked<ContentService>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockJwtService: jest.Mocked<JwtService>;

  const organizationId = 'org-123';
  const deviceId = 'device-456';
  const contentId = 'content-789';

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
    url: 'minio://uploads/test-image.jpg',
    mimeType: 'image/jpeg',
    organizationId,
    status: 'active',
  };

  beforeEach(async () => {
    mockContentService = {
      findById: jest.fn(),
    } as any;

    mockStorageService = {
      isMinioAvailable: jest.fn().mockReturnValue(true),
      getObject: jest.fn(),
    } as any;

    mockJwtService = {
      verify: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviceContentController],
      providers: [
        { provide: ContentService, useValue: mockContentService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: JwtService, useValue: mockJwtService },
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
      return req;
    };

    const createMockResponse = () => {
      const res: any = {
        set: jest.fn().mockReturnThis(),
        end: jest.fn(),
        redirect: jest.fn(),
      };
      return res;
    };

    it('should serve content file with valid device JWT from Authorization header', async () => {
      const req = createMockRequest('valid-device-token');
      const res = createMockResponse();

      mockContentService.findById.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);

      // Create an async iterable stream mock
      const buffer = Buffer.from('file-content');
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield buffer;
        },
      };
      mockStorageService.getObject.mockResolvedValue(stream as any);

      await controller.serveFile(contentId, req, res);

      expect(mockContentService.findById).toHaveBeenCalledWith(contentId);
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-device-token', {
        secret: process.env.DEVICE_JWT_SECRET,
        algorithms: ['HS256'],
      });
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'image/jpeg',
          'Content-Length': String(buffer.length),
        }),
      );
      expect(res.end).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('should serve content file with valid device JWT from query parameter', async () => {
      const req = createMockRequest(undefined, 'valid-query-token');
      const res = createMockResponse();

      mockContentService.findById.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);

      const buffer = Buffer.from('file-content');
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield buffer;
        },
      };
      mockStorageService.getObject.mockResolvedValue(stream as any);

      await controller.serveFile(contentId, req, res);

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-query-token', {
        secret: process.env.DEVICE_JWT_SECRET,
        algorithms: ['HS256'],
      });
      expect(res.end).toHaveBeenCalled();
    });

    it('should return 401 when no token is provided', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockContentService.findById.mockResolvedValue(mockContent as any);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return 401 when token is invalid', async () => {
      const req = createMockRequest('invalid-token');
      const res = createMockResponse();

      mockContentService.findById.mockResolvedValue(mockContent as any);
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

      mockContentService.findById.mockResolvedValue(mockContent as any);
      mockJwtService.verify.mockReturnValue({
        ...validDevicePayload,
        type: 'user',
      });

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return 403 when content belongs to different organization', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      const contentFromDifferentOrg = {
        ...mockContent,
        organizationId: 'other-org-999',
      };
      mockContentService.findById.mockResolvedValue(contentFromDifferentOrg as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return 404 when content does not exist', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      mockContentService.findById.mockResolvedValue(null);

      await expect(controller.serveFile(contentId, req, res)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return 404 when content has no URL', async () => {
      const req = createMockRequest('valid-token');
      const res = createMockResponse();

      mockContentService.findById.mockResolvedValue({
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
      mockContentService.findById.mockResolvedValue(externalContent as any);
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

      mockContentService.findById.mockResolvedValue(mockContent as any);
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
      mockContentService.findById.mockResolvedValue(contentNoMime as any);
      mockJwtService.verify.mockReturnValue(validDevicePayload);

      const buffer = Buffer.from('binary-data');
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield buffer;
        },
      };
      mockStorageService.getObject.mockResolvedValue(stream as any);

      await controller.serveFile(contentId, req, res);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/octet-stream',
        }),
      );
    });
  });
});
