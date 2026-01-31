import {
  CircuitBreakerService,
  CircuitState,
  CircuitOpenError,
} from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('execute', () => {
    it('executes function when circuit is closed', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await service.execute('test-circuit', fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('returns function result on success', async () => {
      const expectedResult = { data: 'test' };
      const fn = jest.fn().mockResolvedValue(expectedResult);

      const result = await service.execute('test-circuit', fn);

      expect(result).toEqual(expectedResult);
    });

    it('throws error when function fails', async () => {
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(service.execute('test-circuit', fn)).rejects.toThrow('Test error');
    });
  });

  describe('circuit opening', () => {
    const config = {
      failureThreshold: 3,
      resetTimeout: 10000,
      successThreshold: 2,
      failureWindow: 60000,
    };

    it('opens circuit after reaching failure threshold', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Fail 3 times (failure threshold)
      for (let i = 0; i < 3; i++) {
        await expect(service.execute('test-circuit', fn, config)).rejects.toThrow();
      }

      // Circuit should now be open
      expect(service.getCircuitState('test-circuit')).toBe(CircuitState.OPEN);
    });

    it('throws CircuitOpenError when circuit is open', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(service.execute('test-circuit', fn, config)).rejects.toThrow();
      }

      // Next call should throw CircuitOpenError
      await expect(service.execute('test-circuit', fn, config)).rejects.toThrow(
        CircuitOpenError,
      );
    });

    it('does not open circuit if failures are outside window', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      const windowConfig = { ...config, failureWindow: 1000 };

      // Fail twice
      await expect(service.execute('test-circuit', fn, windowConfig)).rejects.toThrow();
      await expect(service.execute('test-circuit', fn, windowConfig)).rejects.toThrow();

      // Wait past the failure window
      jest.advanceTimersByTime(1500);

      // Fail once more - should not open circuit (previous failures expired)
      await expect(service.execute('test-circuit', fn, windowConfig)).rejects.toThrow();

      expect(service.getCircuitState('test-circuit')).toBe(CircuitState.CLOSED);
    });
  });

  describe('circuit recovery', () => {
    const config = {
      failureThreshold: 2,
      resetTimeout: 5000,
      successThreshold: 2,
      failureWindow: 60000,
    };

    it('transitions to half-open after reset timeout', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
      const successFn = jest.fn().mockResolvedValue('success');

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(service.execute('test-circuit', failingFn, config)).rejects.toThrow();
      }

      expect(service.getCircuitState('test-circuit')).toBe(CircuitState.OPEN);

      // Advance past reset timeout
      jest.advanceTimersByTime(5500);

      // Next call should trigger half-open state
      await service.execute('test-circuit', successFn, config);

      expect(service.getCircuitState('test-circuit')).toBe(CircuitState.HALF_OPEN);
    });

    it('closes circuit after success threshold in half-open state', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
      const successFn = jest.fn().mockResolvedValue('success');

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(service.execute('test-circuit', failingFn, config)).rejects.toThrow();
      }

      // Advance past reset timeout
      jest.advanceTimersByTime(5500);

      // Succeed twice (success threshold)
      await service.execute('test-circuit', successFn, config);
      await service.execute('test-circuit', successFn, config);

      expect(service.getCircuitState('test-circuit')).toBe(CircuitState.CLOSED);
    });

    it('reopens circuit on failure in half-open state', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
      const successFn = jest.fn().mockResolvedValue('success');

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(service.execute('test-circuit', failingFn, config)).rejects.toThrow();
      }

      // Advance past reset timeout
      jest.advanceTimersByTime(5500);

      // Succeed once, then fail
      await service.execute('test-circuit', successFn, config);
      await expect(service.execute('test-circuit', failingFn, config)).rejects.toThrow();

      expect(service.getCircuitState('test-circuit')).toBe(CircuitState.OPEN);
    });
  });

  describe('executeWithFallback', () => {
    const config = {
      failureThreshold: 2,
      resetTimeout: 5000,
      successThreshold: 2,
      failureWindow: 60000,
    };

    it('returns function result on success', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const fallback = jest.fn().mockReturnValue('fallback');

      const result = await service.executeWithFallback('test-circuit', fn, fallback);

      expect(result).toBe('success');
      expect(fallback).not.toHaveBeenCalled();
    });

    it('returns fallback on function failure', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      const fallback = jest.fn().mockReturnValue('fallback');

      const result = await service.executeWithFallback('test-circuit', fn, fallback);

      expect(result).toBe('fallback');
      expect(fallback).toHaveBeenCalled();
    });

    it('returns fallback when circuit is open', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
      const fallback = jest.fn().mockReturnValue('fallback');

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await service.executeWithFallback('test-circuit', failingFn, fallback, config);
      }

      // Call with circuit open
      const result = await service.executeWithFallback(
        'test-circuit',
        failingFn,
        fallback,
        config,
      );

      expect(result).toBe('fallback');
    });

    it('passes error to fallback function', async () => {
      const error = new Error('test error');
      const fn = jest.fn().mockRejectedValue(error);
      const fallback = jest.fn().mockReturnValue('fallback');

      await service.executeWithFallback('test-circuit', fn, fallback);

      expect(fallback).toHaveBeenCalledWith(error);
    });

    it('supports async fallback functions', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      const fallback = jest.fn().mockResolvedValue('async fallback');

      const result = await service.executeWithFallback('test-circuit', fn, fallback);

      expect(result).toBe('async fallback');
    });
  });

  describe('getCircuitStats', () => {
    it('returns stats for existing circuit', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(service.execute('test-circuit', failingFn)).rejects.toThrow();
      await expect(service.execute('test-circuit', failingFn)).rejects.toThrow();

      const stats = service.getCircuitStats('test-circuit');

      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(2);
      expect(stats.recentFailures).toBe(2);
    });

    it('returns default stats for non-existent circuit', () => {
      const stats = service.getCircuitStats('non-existent');

      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.recentFailures).toBe(0);
    });
  });

  describe('resetCircuit', () => {
    const config = {
      failureThreshold: 2,
      resetTimeout: 5000,
      successThreshold: 2,
      failureWindow: 60000,
    };

    it('resets circuit to closed state', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(service.execute('test-circuit', failingFn, config)).rejects.toThrow();
      }

      expect(service.getCircuitState('test-circuit')).toBe(CircuitState.OPEN);

      // Reset the circuit
      service.resetCircuit('test-circuit');

      expect(service.getCircuitState('test-circuit')).toBe(CircuitState.CLOSED);
    });

    it('clears failure history on reset', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(service.execute('test-circuit', failingFn, config)).rejects.toThrow();

      service.resetCircuit('test-circuit');

      const stats = service.getCircuitStats('test-circuit');
      expect(stats.failures).toBe(0);
      expect(stats.recentFailures).toBe(0);
    });
  });

  describe('getCircuitNames', () => {
    it('returns all circuit names', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      await service.execute('circuit-1', fn);
      await service.execute('circuit-2', fn);
      await service.execute('circuit-3', fn);

      const names = service.getCircuitNames();

      expect(names).toContain('circuit-1');
      expect(names).toContain('circuit-2');
      expect(names).toContain('circuit-3');
    });
  });

  describe('CircuitOpenError', () => {
    it('includes circuit name and retry time', () => {
      const retryTime = Date.now() + 10000;
      const error = new CircuitOpenError('test-circuit', retryTime);

      expect(error.circuitName).toBe('test-circuit');
      expect(error.retryAfter).toBe(retryTime);
      expect(error.name).toBe('CircuitOpenError');
    });
  });
});
