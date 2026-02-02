// Advanced Error Recovery and Retry Logic
// Handles exponential backoff, circuit breaker pattern, and intelligent retries

import { useCallback, useRef, useState } from 'react';

export type ErrorSeverity = 'critical' | 'warning' | 'info';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number; // exponential backoff factor
  jitter: boolean; // add randomness to prevent thundering herd
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // number of failures before opening circuit
  successThreshold: number; // number of successes to close circuit
  timeout: number; // milliseconds before attempting to half-open
}

export interface ErrorInfo {
  id: string;
  error: Error | string;
  severity: ErrorSeverity;
  timestamp: number;
  retryCount: number;
  lastRetryTime?: number;
  nextRetryTime?: number;
  context?: Record<string, any>;
}

export interface UseErrorRecoveryOptions {
  onError?: (errorInfo: ErrorInfo) => void;
  onRetry?: (errorInfo: ErrorInfo) => void;
  onCircuitBreakerChange?: (isOpen: boolean) => void;
  retryConfig?: Partial<RetryConfig>;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  enableLogging?: boolean;
}

// Circuit Breaker States
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastStateChangeTime: number;
}

export function useErrorRecovery(options: UseErrorRecoveryOptions = {}) {
  const {
    onError,
    onRetry,
    onCircuitBreakerChange,
    retryConfig: customRetryConfig,
    circuitBreakerConfig: customCircuitBreakerConfig,
    enableLogging = true,
  } = options;

  // Default configs
  const retryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    ...customRetryConfig,
  };

  const circuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    ...customCircuitBreakerConfig,
  };

  // State
  const [errors, setErrors] = useState<Map<string, ErrorInfo>>(new Map());
  const [circuitBreaker, setCircuitBreaker] = useState<CircuitBreaker>({
    state: 'CLOSED',
    failureCount: 0,
    successCount: 0,
    lastStateChangeTime: Date.now(),
  });

  const retriesRef = useRef<Map<string, { count: number; timeout?: NodeJS.Timeout }>>(
    new Map()
  );

  // Calculate retry delay with exponential backoff
  const calculateDelay = useCallback(
    (retryCount: number): number => {
      const exponentialDelay = retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, retryCount);
      const capped = Math.min(exponentialDelay, retryConfig.maxDelay);
      const withJitter = retryConfig.jitter ? capped * (0.5 + Math.random()) : capped;

      return Math.floor(withJitter);
    },
    [retryConfig]
  );

  // Update circuit breaker state
  const updateCircuitBreakerState = useCallback(
    (isSuccess: boolean) => {
      setCircuitBreaker((prev) => {
        let newState = prev.state;
        let newFailureCount = prev.failureCount;
        let newSuccessCount = prev.successCount;

        if (isSuccess) {
          newFailureCount = 0;
          newSuccessCount = prev.successCount + 1;

          if (prev.state === 'HALF_OPEN' && newSuccessCount >= circuitBreakerConfig.successThreshold) {
            newState = 'CLOSED';
            newSuccessCount = 0;

            if (enableLogging) {
              console.log('[ErrorRecovery] Circuit breaker CLOSED after successful recovery');
            }
            onCircuitBreakerChange?.(false);
          }
        } else {
          newSuccessCount = 0;
          newFailureCount = prev.failureCount + 1;

          if (newFailureCount >= circuitBreakerConfig.failureThreshold && prev.state === 'CLOSED') {
            newState = 'OPEN';

            if (enableLogging) {
              console.log('[ErrorRecovery] Circuit breaker OPENED due to repeated failures');
            }
            onCircuitBreakerChange?.(true);
          }
        }

        return {
          ...prev,
          state: newState,
          failureCount: newFailureCount,
          successCount: newSuccessCount,
          lastFailureTime: isSuccess ? prev.lastFailureTime : Date.now(),
          lastStateChangeTime: newState !== prev.state ? Date.now() : prev.lastStateChangeTime,
        };
      });
    },
    [circuitBreakerConfig, enableLogging, onCircuitBreakerChange]
  );

  // Check if circuit breaker should transition from OPEN to HALF_OPEN
  const checkCircuitBreakerTimeout = useCallback(() => {
    setCircuitBreaker((prev) => {
      if (prev.state === 'OPEN') {
        const timeSinceStateChange = Date.now() - prev.lastStateChangeTime;
        if (timeSinceStateChange >= circuitBreakerConfig.timeout) {
          if (enableLogging) {
            console.log('[ErrorRecovery] Circuit breaker transitioning to HALF_OPEN');
          }
          return {
            ...prev,
            state: 'HALF_OPEN',
            successCount: 0,
            failureCount: 0,
            lastStateChangeTime: Date.now(),
          };
        }
      }
      return prev;
    });
  }, [circuitBreakerConfig.timeout, enableLogging]);

  // Record error
  const recordError = useCallback(
    (id: string, error: Error | string, severity: ErrorSeverity = 'warning', context?: Record<string, any>) => {
      const errorInfo: ErrorInfo = {
        id,
        error,
        severity,
        timestamp: Date.now(),
        retryCount: 0,
        context,
      };

      setErrors((prev) => new Map(prev).set(id, errorInfo));
      updateCircuitBreakerState(false);
      onError?.(errorInfo);

      if (enableLogging) {
        console.error('[ErrorRecovery] Error recorded:', {
          id,
          error: error instanceof Error ? error.message : error,
          severity,
        });
      }
    },
    [updateCircuitBreakerState, onError, enableLogging]
  );

  // Retry with exponential backoff
  const retry = useCallback(
    (
      id: string,
      operation: () => Promise<any>,
      onSuccess?: (result: any) => void,
      onFailure?: (error: Error) => void
    ) => {
      checkCircuitBreakerTimeout();

      // Reject if circuit breaker is open
      if (circuitBreaker.state === 'OPEN') {
        const error = new Error('Circuit breaker is OPEN - too many failures');
        recordError(id, error, 'critical');
        onFailure?.(error as Error);
        return Promise.reject(error);
      }

      const executeRetry = (retryCount = 0) => {
        if (retryCount >= retryConfig.maxAttempts) {
          const error = new Error(`Max retry attempts (${retryConfig.maxAttempts}) exceeded for ${id}`);
          recordError(id, error, 'critical', { retryCount });
          onFailure?.(error as Error);
          return Promise.reject(error);
        }

        return operation()
          .then((result) => {
            // Clear retry state
            retriesRef.current.delete(id);
            setErrors((prev) => {
              const updated = new Map(prev);
              updated.delete(id);
              return updated;
            });

            // Update circuit breaker on success
            updateCircuitBreakerState(true);
            onSuccess?.(result);

            if (enableLogging) {
              console.log('[ErrorRecovery] Operation succeeded:', { id, retryCount });
            }

            return result;
          })
          .catch((error) => {
            const delay = calculateDelay(retryCount);
            const nextRetryTime = Date.now() + delay;

            setErrors((prev) => {
              const updated = new Map(prev);
              const existingInfo = updated.get(id);
              const errorInfo: ErrorInfo = existingInfo ?? {
                id,
                error,
                severity: 'warning' as const,
                timestamp: Date.now(),
                retryCount: 0,
                lastRetryTime: undefined,
                nextRetryTime: undefined,
              };
              errorInfo.retryCount = retryCount + 1;
              errorInfo.lastRetryTime = Date.now();
              errorInfo.nextRetryTime = nextRetryTime;
              updated.set(id, errorInfo);
              return updated;
            });

            onRetry?.({
              id,
              error,
              severity: 'warning',
              timestamp: Date.now(),
              retryCount: retryCount + 1,
              lastRetryTime: Date.now(),
              nextRetryTime,
            });

            if (enableLogging) {
              console.log('[ErrorRecovery] Retrying after', delay, 'ms:', {
                id,
                attempt: retryCount + 1,
                maxAttempts: retryConfig.maxAttempts,
              });
            }

            return new Promise((resolve, reject) => {
              const timeout = setTimeout(
                () => executeRetry(retryCount + 1).then(resolve).catch(reject),
                delay
              );

              // Store timeout for cleanup
              const retryState = retriesRef.current.get(id) ?? { count: 0 };
              retryState.timeout = timeout;
              retriesRef.current.set(id, retryState);
            });
          });
      };

      return executeRetry();
    },
    [
      retryConfig,
      circuitBreaker,
      calculateDelay,
      recordError,
      updateCircuitBreakerState,
      checkCircuitBreakerTimeout,
      enableLogging,
    ]
  );

  // Clear error
  const clearError = useCallback((id: string) => {
    setErrors((prev) => {
      const updated = new Map(prev);
      updated.delete(id);
      return updated;
    });

    const retryState = retriesRef.current.get(id);
    if (retryState?.timeout) {
      clearTimeout(retryState.timeout);
    }
    retriesRef.current.delete(id);
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    retriesRef.current.forEach(({ timeout }) => {
      if (timeout) clearTimeout(timeout);
    });
    retriesRef.current.clear();
    setErrors(new Map());
  }, []);

  // Reset circuit breaker
  const resetCircuitBreaker = useCallback(() => {
    setCircuitBreaker({
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastStateChangeTime: Date.now(),
    });

    if (enableLogging) {
      console.log('[ErrorRecovery] Circuit breaker reset to CLOSED');
    }

    onCircuitBreakerChange?.(false);
  }, [enableLogging, onCircuitBreakerChange]);

  return {
    // State
    errors,
    circuitBreaker,
    isCircuitBreakerOpen: circuitBreaker.state === 'OPEN',

    // Methods
    recordError,
    retry,
    clearError,
    clearAllErrors,
    resetCircuitBreaker,

    // Helpers
    getError: (id: string) => errors.get(id),
    getAllErrors: () => new Map(errors),
    getErrorCount: () => errors.size,
    hasCriticalErrors: () => Array.from(errors.values()).some((e) => e.severity === 'critical'),
  };
}
