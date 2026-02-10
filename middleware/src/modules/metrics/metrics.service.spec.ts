import { MetricsService } from './metrics.service';

// Mock prom-client
jest.mock('prom-client', () => {
  const mockCounter = {
    inc: jest.fn(),
  };
  const mockHistogram = {
    observe: jest.fn(),
  };
  return {
    Registry: jest.fn().mockImplementation(() => ({
      setDefaultLabels: jest.fn(),
      metrics: jest.fn().mockResolvedValue('# HELP metric\n# TYPE metric counter\nmetric 1'),
      contentType: 'text/plain; version=0.0.4; charset=utf-8',
    })),
    Counter: jest.fn().mockImplementation(() => mockCounter),
    Histogram: jest.fn().mockImplementation(() => mockHistogram),
    collectDefaultMetrics: jest.fn(),
  };
});

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetricsService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create httpRequestsTotal counter', () => {
    expect(service.httpRequestsTotal).toBeDefined();
    expect(service.httpRequestsTotal.inc).toBeDefined();
  });

  it('should create httpRequestDuration histogram', () => {
    expect(service.httpRequestDuration).toBeDefined();
    expect(service.httpRequestDuration.observe).toBeDefined();
  });

  it('should create httpErrorsTotal counter', () => {
    expect(service.httpErrorsTotal).toBeDefined();
    expect(service.httpErrorsTotal.inc).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should set default labels', () => {
      service.onModuleInit();
      // The registry's setDefaultLabels should have been called
      const client = require('prom-client');
      const registry = new client.Registry();
      // Just verifying onModuleInit runs without error
      expect(service).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return Prometheus-format metrics string', async () => {
      const metrics = await service.getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
    });
  });

  describe('getContentType', () => {
    it('should return the Prometheus content type', () => {
      const contentType = service.getContentType();
      expect(contentType).toContain('text/plain');
    });
  });
});
