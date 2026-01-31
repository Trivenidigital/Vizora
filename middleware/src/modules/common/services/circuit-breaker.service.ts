import { Injectable, Logger } from '@nestjs/common';

/**
 * Circuit Breaker States
 */
export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation, requests allowed
  OPEN = 'OPEN', // Circuit is open, requests blocked
  HALF_OPEN = 'HALF_OPEN', // Testing if service has recovered
}

/**
 * Configuration for a circuit breaker
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in milliseconds before attempting to close an open circuit */
  resetTimeout: number;
  /** Number of successful calls needed to close the circuit from half-open */
  successThreshold: number;
  /** Time window in milliseconds for counting failures */
  failureWindow: number;
  /** Name for logging purposes */
  name: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  successThreshold: 3,
  failureWindow: 60000, // 1 minute
};

/**
 * Internal state for a circuit
 */
interface CircuitInternalState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  nextRetryTime: number | null;
  failureTimestamps: number[];
}

/**
 * Circuit Breaker Service
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * when calling external services.
 *
 * Usage:
 * ```typescript
 * const result = await this.circuitBreaker.execute(
 *   'realtime-service',
 *   () => this.httpService.post(url, data),
 *   { failureThreshold: 3, resetTimeout: 10000 }
 * );
 * ```
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitInternalState>();
  private readonly configs = new Map<string, CircuitBreakerConfig>();

  /**
   * Execute a function with circuit breaker protection
   *
   * @param circuitName - Unique name for this circuit
   * @param fn - Function to execute
   * @param config - Optional circuit configuration
   * @returns Result of the function
   * @throws CircuitOpenError if circuit is open
   */
  async execute<T>(
    circuitName: string,
    fn: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>,
  ): Promise<T> {
    const circuitConfig = this.getOrCreateConfig(circuitName, config);
    const state = this.getOrCreateState(circuitName);

    // Clean up old failure timestamps
    this.cleanupFailures(circuitName, circuitConfig.failureWindow);

    // Check circuit state
    if (state.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset(state)) {
        this.transitionToHalfOpen(circuitName);
      } else {
        this.logger.warn(
          `Circuit ${circuitName} is OPEN. Request blocked. Retry in ${Math.ceil((state.nextRetryTime! - Date.now()) / 1000)}s`,
        );
        throw new CircuitOpenError(circuitName, state.nextRetryTime!);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(circuitName);
      return result;
    } catch (error) {
      this.onFailure(circuitName, error);
      throw error;
    }
  }

  /**
   * Execute a function with fallback if circuit is open
   *
   * @param circuitName - Unique name for this circuit
   * @param fn - Function to execute
   * @param fallback - Fallback function if circuit is open or fn fails
   * @param config - Optional circuit configuration
   * @returns Result of fn or fallback
   */
  async executeWithFallback<T>(
    circuitName: string,
    fn: () => Promise<T>,
    fallback: (error?: Error) => T | Promise<T>,
    config?: Partial<CircuitBreakerConfig>,
  ): Promise<T> {
    try {
      return await this.execute(circuitName, fn, config);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        this.logger.debug(
          `Circuit ${circuitName} is open, using fallback`,
        );
      }
      return fallback(error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get the current state of a circuit
   */
  getCircuitState(circuitName: string): CircuitState {
    return this.circuits.get(circuitName)?.state ?? CircuitState.CLOSED;
  }

  /**
   * Get statistics for a circuit
   */
  getCircuitStats(circuitName: string): {
    state: CircuitState;
    failures: number;
    successes: number;
    recentFailures: number;
  } {
    const state = this.circuits.get(circuitName);
    const config = this.configs.get(circuitName);

    if (!state) {
      return {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        recentFailures: 0,
      };
    }

    const now = Date.now();
    const windowStart = now - (config?.failureWindow ?? DEFAULT_CONFIG.failureWindow);
    const recentFailures = state.failureTimestamps.filter((t) => t > windowStart).length;

    return {
      state: state.state,
      failures: state.failures,
      successes: state.successes,
      recentFailures,
    };
  }

  /**
   * Manually reset a circuit to closed state
   */
  resetCircuit(circuitName: string): void {
    const state = this.circuits.get(circuitName);
    if (state) {
      state.state = CircuitState.CLOSED;
      state.failures = 0;
      state.successes = 0;
      state.failureTimestamps = [];
      state.lastFailureTime = null;
      state.nextRetryTime = null;
      this.logger.log(`Circuit ${circuitName} manually reset to CLOSED`);
    }
  }

  /**
   * Get all circuit names
   */
  getCircuitNames(): string[] {
    return Array.from(this.circuits.keys());
  }

  private getOrCreateConfig(
    circuitName: string,
    config?: Partial<CircuitBreakerConfig>,
  ): CircuitBreakerConfig {
    if (!this.configs.has(circuitName)) {
      this.configs.set(circuitName, {
        ...DEFAULT_CONFIG,
        name: circuitName,
        ...config,
      });
    }
    return this.configs.get(circuitName)!;
  }

  private getOrCreateState(circuitName: string): CircuitInternalState {
    if (!this.circuits.has(circuitName)) {
      this.circuits.set(circuitName, {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        nextRetryTime: null,
        failureTimestamps: [],
      });
    }
    return this.circuits.get(circuitName)!;
  }

  private shouldAttemptReset(state: CircuitInternalState): boolean {
    return state.nextRetryTime !== null && Date.now() >= state.nextRetryTime;
  }

  private transitionToHalfOpen(circuitName: string): void {
    const state = this.circuits.get(circuitName)!;
    state.state = CircuitState.HALF_OPEN;
    state.successes = 0;
    this.logger.log(`Circuit ${circuitName} transitioned to HALF_OPEN`);
  }

  private onSuccess(circuitName: string): void {
    const state = this.circuits.get(circuitName)!;
    const config = this.configs.get(circuitName)!;

    if (state.state === CircuitState.HALF_OPEN) {
      state.successes++;
      if (state.successes >= config.successThreshold) {
        state.state = CircuitState.CLOSED;
        state.failures = 0;
        state.failureTimestamps = [];
        this.logger.log(`Circuit ${circuitName} transitioned to CLOSED`);
      }
    } else if (state.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      state.failures = 0;
    }
  }

  private onFailure(circuitName: string, error: unknown): void {
    const state = this.circuits.get(circuitName)!;
    const config = this.configs.get(circuitName)!;
    const now = Date.now();

    state.failures++;
    state.lastFailureTime = now;
    state.failureTimestamps.push(now);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.warn(`Circuit ${circuitName} failure #${state.failures}: ${errorMessage}`);

    if (state.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state reopens the circuit
      this.openCircuit(circuitName, config);
    } else if (state.state === CircuitState.CLOSED) {
      // Check if we've exceeded the failure threshold
      const recentFailures = state.failureTimestamps.filter(
        (t) => t > now - config.failureWindow,
      ).length;

      if (recentFailures >= config.failureThreshold) {
        this.openCircuit(circuitName, config);
      }
    }
  }

  private openCircuit(circuitName: string, config: CircuitBreakerConfig): void {
    const state = this.circuits.get(circuitName)!;
    state.state = CircuitState.OPEN;
    state.nextRetryTime = Date.now() + config.resetTimeout;
    this.logger.warn(
      `Circuit ${circuitName} transitioned to OPEN. Will retry in ${config.resetTimeout / 1000}s`,
    );
  }

  private cleanupFailures(circuitName: string, windowMs: number): void {
    const state = this.circuits.get(circuitName);
    if (!state) return;

    const cutoff = Date.now() - windowMs;
    state.failureTimestamps = state.failureTimestamps.filter((t) => t > cutoff);
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly retryAfter: number,
  ) {
    super(`Circuit ${circuitName} is open. Retry after ${new Date(retryAfter).toISOString()}`);
    this.name = 'CircuitOpenError';
  }
}
