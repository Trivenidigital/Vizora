import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from '../modules/database/database.service';

describe('AppController', () => {
  let controller: AppController;
  let mockAppService: jest.Mocked<AppService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    mockAppService = {
      getData: jest.fn(),
    } as any;

    mockDatabaseService = {
      $queryRaw: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: mockAppService },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getData', () => {
    it('should return data from AppService', () => {
      const expectedData = { message: 'Welcome to Vizora API' };
      mockAppService.getData.mockReturnValue(expectedData);

      const result = controller.getData();

      expect(result).toEqual(expectedData);
      expect(mockAppService.getData).toHaveBeenCalled();
    });
  });

  describe('health', () => {
    it('should return ok status when database is connected', async () => {
      mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.health();

      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
    });

    it('should return error status when database is disconnected', async () => {
      const dbError = new Error('Connection refused');
      mockDatabaseService.$queryRaw.mockRejectedValue(dbError);

      const result = await controller.health();

      expect(result.status).toBe('error');
      expect(result.database).toBe('disconnected');
      expect(result.error).toBe('Connection refused');
      expect(result).toHaveProperty('timestamp');
    });

    it('should include timestamp in ISO format', async () => {
      mockDatabaseService.$queryRaw.mockResolvedValue([]);

      const result = await controller.health();

      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('should include uptime as a number', async () => {
      mockDatabaseService.$queryRaw.mockResolvedValue([]);

      const result = await controller.health();

      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ready', () => {
    it('should return ready: true when database is accessible', async () => {
      mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.ready();

      expect(result).toEqual({ ready: true });
    });

    it('should return ready: false when database is not accessible', async () => {
      mockDatabaseService.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await controller.ready();

      expect(result).toEqual({ ready: false });
    });

    it('should handle timeout errors', async () => {
      mockDatabaseService.$queryRaw.mockRejectedValue(new Error('Query timeout'));

      const result = await controller.ready();

      expect(result).toEqual({ ready: false });
    });
  });
});
