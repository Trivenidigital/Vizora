import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let mockMetricsService: Partial<MetricsService>;
  let mockResponse: any;

  beforeEach(() => {
    mockMetricsService = {
      getMetrics: jest.fn().mockResolvedValue('# HELP vizora_http_requests_total\nvizora_http_requests_total 42'),
      getContentType: jest.fn().mockReturnValue('text/plain; version=0.0.4; charset=utf-8'),
    };

    mockResponse = {
      set: jest.fn(),
      end: jest.fn(),
    };

    controller = new MetricsController(mockMetricsService as MetricsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should set the content type header', async () => {
      await controller.getMetrics(mockResponse);

      expect(mockResponse.set).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4; charset=utf-8',
      );
    });

    it('should end response with metrics data', async () => {
      await controller.getMetrics(mockResponse);

      expect(mockResponse.end).toHaveBeenCalledWith(
        expect.stringContaining('vizora_http_requests_total'),
      );
    });

    it('should call metricsService.getMetrics', async () => {
      await controller.getMetrics(mockResponse);

      expect(mockMetricsService.getMetrics).toHaveBeenCalled();
    });

    it('should call metricsService.getContentType', async () => {
      await controller.getMetrics(mockResponse);

      expect(mockMetricsService.getContentType).toHaveBeenCalled();
    });
  });
});
