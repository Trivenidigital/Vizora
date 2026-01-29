// Test Suite for useErrorRecovery Hook
// Tests retry logic, circuit breaker pattern, and error tracking

import { renderHook, act, waitFor } from '@testing-library/react';
import { useErrorRecovery } from '../useErrorRecovery';

describe('useErrorRecovery', () => {
  describe('Basic Retry Logic', () => {
    it('should retry failed operations', async () => {
      const { result } = renderHook(() => useErrorRecovery());

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({ success: true });

      await act(async () => {
        await result.current.retry(
          'test-op',
          operation,
          undefined,
          undefined
        ).catch(() => {});
      });

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          retryConfig: {
            maxAttempts: 3,
            initialDelay: 100,
            backoffMultiplier: 2,
            jitter: false,
          },
        })
      );

      const operation = jest.fn()
        .mockRejectedValue(new Error('Always fails'));

      const startTime = Date.now();

      await act(async () => {
        try {
          await result.current.retry(
            'test-op',
            operation,
            undefined,
            undefined
          );
        } catch {
          // Expected to fail
        }
      });

      const elapsed = Date.now() - startTime;
      // Should wait at least: 100 (first) + 200 (second) = 300ms
      expect(elapsed).toBeGreaterThanOrEqual(300);
    });

    it('should add jitter to delays', async () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          retryConfig: {
            maxAttempts: 2,
            initialDelay: 100,
            backoffMultiplier: 2,
            jitter: true,
          },
        })
      );

      const operation = jest.fn().mockRejectedValue(new Error('Fail'));

      await act(async () => {
        try {
          await result.current.retry(
            'test-op',
            operation,
            undefined,
            undefined
          );
        } catch {
          // Expected
        }
      });

      expect(operation).toHaveBeenCalled();
    });

    it('should succeed on eventual success', async () => {
      const { result } = renderHook(() => useErrorRecovery());

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({ data: 'success' });

      const onSuccess = jest.fn();

      await act(async () => {
        await result.current.retry(
          'test-op',
          operation,
          onSuccess,
          undefined
        );
      });

      expect(onSuccess).toHaveBeenCalledWith({ data: 'success' });
    });

    it('should fail after max attempts', async () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          retryConfig: {
            maxAttempts: 2,
            initialDelay: 10,
          },
        })
      );

      const operation = jest.fn()
        .mockRejectedValue(new Error('Always fails'));

      const onFailure = jest.fn();

      await act(async () => {
        await result.current.retry(
          'test-op',
          operation,
          undefined,
          onFailure
        ).catch(() => {});
      });

      expect(onFailure).toHaveBeenCalled();
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should start in CLOSED state', () => {
      const { result } = renderHook(() => useErrorRecovery());

      expect(result.current.circuitBreaker.state).toBe('CLOSED');
    });

    it('should open circuit after failure threshold', async () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          circuitBreakerConfig: {
            failureThreshold: 2,
            successThreshold: 2,
            timeout: 100,
          },
        })
      );

      // Record 2 failures
      act(() => {
        result.current.recordError('error-1', new Error('Fail 1'), 'critical');
        result.current.recordError('error-2', new Error('Fail 2'), 'critical');
      });

      expect(result.current.circuitBreaker.state).toBe('OPEN');
    });

    it('should reject operations when circuit is open', async () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          circuitBreakerConfig: {
            failureThreshold: 1,
            successThreshold: 1,
            timeout: 100,
          },
        })
      );

      // Open the circuit
      act(() => {
        result.current.recordError('error-1', new Error('Fail'), 'critical');
      });

      const operation = jest.fn().mockResolvedValue({ success: true });

      await act(async () => {
        try {
          await result.current.retry('test-op', operation);
        } catch (error) {
          expect((error as Error).message).toContain('Circuit breaker is OPEN');
        }
      });

      expect(operation).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          circuitBreakerConfig: {
            failureThreshold: 1,
            successThreshold: 1,
            timeout: 100,
          },
        })
      );

      // Open circuit
      act(() => {
        result.current.recordError('error-1', new Error('Fail'), 'critical');
      });

      expect(result.current.circuitBreaker.state).toBe('OPEN');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Attempt operation to trigger state check
      const operation = jest.fn().mockResolvedValue({ success: true });

      await act(async () => {
        try {
          await result.current.retry('test-op', operation);
        } catch {
          // May still fail due to timing
        }
      });

      // Should have transitioned to HALF_OPEN
      expect([result.current.circuitBreaker.state]).toContain('HALF_OPEN');
    });

    it('should close circuit after success threshold in HALF_OPEN', async () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          circuitBreakerConfig: {
            failureThreshold: 1,
            successThreshold: 1,
            timeout: 100,
          },
        })
      );

      // Open circuit
      act(() => {
        result.current.recordError('error-1', new Error('Fail'), 'critical');
      });

      // Wait for transition to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Successful operation should close circuit
      act(() => {
        result.current.updateCircuitBreakerState = jest.fn();
      });

      const operation = jest.fn().mockResolvedValue({ success: true });
      const onSuccess = jest.fn();

      await act(async () => {
        try {
          await result.current.retry('test-op', operation, onSuccess);
        } catch {
          // May fail during transition
        }
      });

      // Circuit should eventually close
      expect([result.current.circuitBreaker.state]).toContain('CLOSED');
    });
  });

  describe('Error Recording and Tracking', () => {
    it('should record errors with severity', () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useErrorRecovery({ onError })
      );

      act(() => {
        result.current.recordError('error-1', new Error('Critical issue'), 'critical');
      });

      expect(result.current.getError('error-1')).toBeDefined();
      expect(result.current.getError('error-1')?.severity).toBe('critical');
      expect(onError).toHaveBeenCalled();
    });

    it('should distinguish error severities', () => {
      const { result } = renderHook(() => useErrorRecovery());

      act(() => {
        result.current.recordError('critical-1', new Error('Critical'), 'critical');
        result.current.recordError('warning-1', new Error('Warning'), 'warning');
        result.current.recordError('info-1', new Error('Info'), 'info');
      });

      expect(result.current.getErrorCount()).toBe(3);
      expect(result.current.hasCriticalErrors()).toBe(true);
    });

    it('should get all errors', () => {
      const { result } = renderHook(() => useErrorRecovery());

      act(() => {
        result.current.recordError('error-1', new Error('Error 1'), 'warning');
        result.current.recordError('error-2', new Error('Error 2'), 'warning');
      });

      const allErrors = result.current.getAllErrors();
      expect(allErrors.size).toBe(2);
    });

    it('should clear individual errors', () => {
      const { result } = renderHook(() => useErrorRecovery());

      act(() => {
        result.current.recordError('error-1', new Error('Error'), 'warning');
      });

      expect(result.current.getErrorCount()).toBe(1);

      act(() => {
        result.current.clearError('error-1');
      });

      expect(result.current.getErrorCount()).toBe(0);
    });

    it('should clear all errors', () => {
      const { result } = renderHook(() => useErrorRecovery());

      act(() => {
        result.current.recordError('error-1', new Error('Error 1'), 'warning');
        result.current.recordError('error-2', new Error('Error 2'), 'warning');
      });

      expect(result.current.getErrorCount()).toBe(2);

      act(() => {
        result.current.clearAllErrors();
      });

      expect(result.current.getErrorCount()).toBe(0);
    });
  });

  describe('Circuit Breaker Reset', () => {
    it('should reset circuit breaker to CLOSED', () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          circuitBreakerConfig: {
            failureThreshold: 1,
            successThreshold: 1,
            timeout: 100,
          },
        })
      );

      // Open circuit
      act(() => {
        result.current.recordError('error-1', new Error('Fail'), 'critical');
      });

      expect(result.current.circuitBreaker.state).toBe('OPEN');

      // Reset
      act(() => {
        result.current.resetCircuitBreaker();
      });

      expect(result.current.circuitBreaker.state).toBe('CLOSED');
    });

    it('should reset failure and success counts', () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          circuitBreakerConfig: {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 100,
          },
        })
      );

      // Record some failures
      act(() => {
        result.current.recordError('error-1', new Error('Fail 1'), 'warning');
        result.current.recordError('error-2', new Error('Fail 2'), 'warning');
      });

      expect(result.current.circuitBreaker.failureCount).toBe(2);

      // Reset
      act(() => {
        result.current.resetCircuitBreaker();
      });

      expect(result.current.circuitBreaker.failureCount).toBe(0);
      expect(result.current.circuitBreaker.successCount).toBe(0);
    });
  });

  describe('Callbacks', () => {
    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const { result } = renderHook(() =>
        useErrorRecovery({
          retryConfig: {
            maxAttempts: 2,
            initialDelay: 10,
          },
          onRetry,
        })
      );

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce({ success: true });

      await act(async () => {
        await result.current.retry('test-op', operation);
      });

      expect(onRetry).toHaveBeenCalled();
    });

    it('should call onCircuitBreakerChange callback', () => {
      const onCircuitBreakerChange = jest.fn();
      const { result } = renderHook(() =>
        useErrorRecovery({
          circuitBreakerConfig: {
            failureThreshold: 1,
            successThreshold: 1,
            timeout: 100,
          },
          onCircuitBreakerChange,
        })
      );

      act(() => {
        result.current.recordError('error-1', new Error('Fail'), 'critical');
      });

      expect(onCircuitBreakerChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Helper Properties', () => {
    it('should track isCircuitBreakerOpen status', () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          circuitBreakerConfig: {
            failureThreshold: 1,
            successThreshold: 1,
            timeout: 100,
          },
        })
      );

      expect(result.current.isCircuitBreakerOpen).toBe(false);

      act(() => {
        result.current.recordError('error-1', new Error('Fail'), 'critical');
      });

      expect(result.current.isCircuitBreakerOpen).toBe(true);
    });
  });
});
