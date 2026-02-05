import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let mockUsersService: jest.Mocked<UsersService>;

  const organizationId = 'org-123';
  const userId = 'user-admin-1';

  beforeEach(async () => {
    mockUsersService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      invite: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    const pagination = { page: 1, limit: 10 };

    it('should return paginated users', async () => {
      const expectedResult = {
        data: [
          { id: 'user-1', email: 'alice@test.com', firstName: 'Alice', lastName: 'Smith' },
          { id: 'user-2', email: 'bob@test.com', firstName: 'Bob', lastName: 'Jones' },
        ],
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      };
      mockUsersService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
      expect(mockUsersService.findAll).toHaveBeenCalledWith(organizationId, pagination);
    });

    it('should handle empty results', async () => {
      const expectedResult = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      mockUsersService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const expectedUser = { id: 'user-1', email: 'alice@test.com', firstName: 'Alice', lastName: 'Smith' };
      mockUsersService.findOne.mockResolvedValue(expectedUser as any);

      const result = await controller.findOne(organizationId, 'user-1');

      expect(result).toEqual(expectedUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(organizationId, 'user-1');
    });

    it('should propagate NotFoundException from service', async () => {
      mockUsersService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(organizationId, 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('invite', () => {
    const inviteDto = {
      email: 'new@test.com',
      firstName: 'New',
      lastName: 'User',
      role: 'viewer',
    };

    it('should invite a new user', async () => {
      const expectedResult = {
        user: { id: 'user-new', ...inviteDto },
        tempPassword: 'temp123',
      };
      mockUsersService.invite.mockResolvedValue(expectedResult as any);

      const result = await controller.invite(organizationId, userId, inviteDto as any);

      expect(result).toEqual(expectedResult);
      expect(mockUsersService.invite).toHaveBeenCalledWith(organizationId, inviteDto, userId);
    });

    it('should propagate ConflictException for duplicate email', async () => {
      mockUsersService.invite.mockRejectedValue(new ConflictException('A user with this email already exists'));

      await expect(
        controller.invite(organizationId, userId, { email: 'duplicate@test.com', firstName: 'X', lastName: 'Y', role: 'viewer' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    const updateDto = { firstName: 'Updated', role: 'manager' };

    it('should update a user', async () => {
      const expectedUser = { id: 'user-1', ...updateDto, email: 'alice@test.com' };
      mockUsersService.update.mockResolvedValue(expectedUser as any);

      const result = await controller.update(organizationId, userId, 'user-1', updateDto as any);

      expect(result).toEqual(expectedUser);
      expect(mockUsersService.update).toHaveBeenCalledWith(organizationId, 'user-1', updateDto, userId);
    });
  });

  describe('deactivate', () => {
    it('should deactivate a user', async () => {
      const expectedUser = { id: 'user-1', isActive: false };
      mockUsersService.deactivate.mockResolvedValue(expectedUser as any);

      const result = await controller.deactivate(organizationId, userId, 'user-1');

      expect(result).toEqual(expectedUser);
      expect(mockUsersService.deactivate).toHaveBeenCalledWith(organizationId, 'user-1', userId);
    });

    it('should propagate BadRequestException for self-deactivation', async () => {
      mockUsersService.deactivate.mockRejectedValue(new BadRequestException('Cannot deactivate your own account'));

      await expect(
        controller.deactivate(organizationId, userId, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
