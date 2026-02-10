import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  // Factory functions to create fresh mock instances per test
  const createCounter = () => ({ inc: jest.fn() });
  const createGauge = () => ({ inc: jest.fn(), dec: jest.fn(), set: jest.fn() });
  const createHistogram = () => ({ observe: jest.fn() });

  beforeEach(() => {
    jest.clearAllMocks();

    // Construct with fresh mock instances to avoid shared references
    service = new MetricsService(
      createCounter() as any, // wsConnectionsTotal
      createGauge() as any,   // wsConnectionsActive
      createCounter() as any, // wsMessagesTotal
      createHistogram() as any, // wsMessageDuration
      createCounter() as any, // heartbeatTotal
      createHistogram() as any, // heartbeatDuration
      createCounter() as any, // heartbeatErrorsTotal
      createCounter() as any, // contentImpressionsTotal
      createCounter() as any, // contentErrorsTotal
      createGauge() as any,   // devicesOnline
      createGauge() as any,   // deviceCpuUsageAvg
      createGauge() as any,   // deviceMemoryUsageAvg
      createCounter() as any, // httpRequestsTotal
      createHistogram() as any, // httpRequestDuration
      createCounter() as any, // redisOperationsTotal
      createHistogram() as any, // redisOperationDuration
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordConnection', () => {
    it('should increment total connections and active gauge on connected', () => {
      service.recordConnection('org-1', 'connected');

      expect(service.wsConnectionsTotal.inc).toHaveBeenCalledWith({
        organization_id: 'org-1',
        status: 'connected',
      });
      expect(service.wsConnectionsActive.inc).toHaveBeenCalledWith({
        organization_id: 'org-1',
      });
    });

    it('should increment total connections and decrement active gauge on disconnected', () => {
      service.recordConnection('org-1', 'disconnected');

      expect(service.wsConnectionsTotal.inc).toHaveBeenCalledWith({
        organization_id: 'org-1',
        status: 'disconnected',
      });
      expect(service.wsConnectionsActive.dec).toHaveBeenCalledWith({
        organization_id: 'org-1',
      });
    });
  });

  describe('recordMessage', () => {
    it('should increment message counter and observe duration', () => {
      service.recordMessage('heartbeat', 0.015);

      expect(service.wsMessagesTotal.inc).toHaveBeenCalledWith({ type: 'heartbeat' });
      expect(service.wsMessageDuration.observe).toHaveBeenCalledWith({ type: 'heartbeat' }, 0.015);
    });
  });

  describe('recordHeartbeat', () => {
    it('should increment heartbeat counter with success label', () => {
      service.recordHeartbeat('device-1', true, 0.05);

      expect(service.heartbeatTotal.inc).toHaveBeenCalledWith({ success: 'true' });
      expect(service.heartbeatDuration.observe).toHaveBeenCalledWith(0.05);
    });

    it('should increment error counter on failure', () => {
      service.recordHeartbeat('device-1', false, 0.1);

      expect(service.heartbeatTotal.inc).toHaveBeenCalledWith({ success: 'false' });
      expect(service.heartbeatErrorsTotal.inc).toHaveBeenCalled();
    });

    it('should not increment error counter on success', () => {
      service.recordHeartbeat('device-1', true, 0.05);

      expect(service.heartbeatErrorsTotal.inc).not.toHaveBeenCalled();
    });
  });

  describe('recordImpression', () => {
    it('should increment impression counter', () => {
      service.recordImpression('device-1', 'content-1');

      expect(service.contentImpressionsTotal.inc).toHaveBeenCalled();
    });
  });

  describe('recordContentError', () => {
    it('should increment error counter with type label', () => {
      service.recordContentError('device-1', 'load_failed');

      expect(service.contentErrorsTotal.inc).toHaveBeenCalledWith({
        error_type: 'load_failed',
      });
    });
  });

  describe('updateDeviceStatus', () => {
    it('should increment devices online gauge for online status', () => {
      service.updateDeviceStatus('device-1', 'org-1', 'online');

      expect(service.devicesOnline.inc).toHaveBeenCalledWith({
        organization_id: 'org-1',
      });
    });

    it('should decrement devices online gauge for offline status', () => {
      service.updateDeviceStatus('device-1', 'org-1', 'offline');

      expect(service.devicesOnline.dec).toHaveBeenCalledWith({
        organization_id: 'org-1',
      });
    });

    it('should decrement devices online gauge for error status', () => {
      service.updateDeviceStatus('device-1', 'org-1', 'error');

      expect(service.devicesOnline.dec).toHaveBeenCalledWith({
        organization_id: 'org-1',
      });
    });
  });

  describe('updateDeviceMetrics', () => {
    it('should set CPU and memory gauges for organization', () => {
      service.updateDeviceMetrics('org-1', 75.5, 60.2);

      expect(service.deviceCpuUsageAvg.set).toHaveBeenCalledWith(
        { organization_id: 'org-1' },
        75.5,
      );
      expect(service.deviceMemoryUsageAvg.set).toHaveBeenCalledWith(
        { organization_id: 'org-1' },
        60.2,
      );
    });
  });

  describe('recordHttpRequest', () => {
    it('should increment request counter and observe duration', () => {
      service.recordHttpRequest('GET', '/api/v1/health', 200, 0.025);

      expect(service.httpRequestsTotal.inc).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/health',
        status: '200',
      });
      expect(service.httpRequestDuration.observe).toHaveBeenCalledWith(
        { method: 'GET', path: '/api/v1/health' },
        0.025,
      );
    });

    it('should handle error status codes', () => {
      service.recordHttpRequest('POST', '/api/v1/content', 500, 1.5);

      expect(service.httpRequestsTotal.inc).toHaveBeenCalledWith({
        method: 'POST',
        path: '/api/v1/content',
        status: '500',
      });
    });
  });

  describe('recordRedisOperation', () => {
    it('should increment operation counter and observe duration', () => {
      service.recordRedisOperation('GET', 0.001);

      expect(service.redisOperationsTotal.inc).toHaveBeenCalledWith({ operation: 'GET' });
      expect(service.redisOperationDuration.observe).toHaveBeenCalledWith({ operation: 'GET' }, 0.001);
    });
  });
});
