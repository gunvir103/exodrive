import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  halfOpenRetries: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalRequests: number;
  rejectedRequests: number;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private halfOpenAttempts = 0;
  private nextAttemptTime?: Date;
  private totalRequests = 0;
  private rejectedRequests = 0;

  constructor(private config: CircuitBreakerConfig) {
    super();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (!this.canAttempt()) {
      this.rejectedRequests++;
      this.emit('requestRejected', {
        state: this.state,
        reason: 'Circuit breaker is open',
      });
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private canAttempt(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
      
      case CircuitState.OPEN:
        if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime.getTime()) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;
      
      case CircuitState.HALF_OPEN:
        return this.halfOpenAttempts < this.config.halfOpenRetries;
      
      default:
        return false;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = new Date();

    switch (this.state) {
      case CircuitState.CLOSED:
        this.failureCount = 0;
        break;
      
      case CircuitState.HALF_OPEN:
        this.halfOpenAttempts++;
        if (this.halfOpenAttempts >= this.config.halfOpenRetries) {
          this.transitionToClosed();
        }
        break;
      
      case CircuitState.OPEN:
        // Should not happen, but handle gracefully
        this.transitionToHalfOpen();
        break;
    }

    this.emit('success', {
      state: this.state,
      successCount: this.successCount,
    });
  }

  private onFailure(error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionToOpen();
        }
        break;
      
      case CircuitState.HALF_OPEN:
        this.transitionToOpen();
        break;
      
      case CircuitState.OPEN:
        // Already open, update next attempt time
        this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
        break;
    }

    this.emit('failure', {
      state: this.state,
      failureCount: this.failureCount,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.nextAttemptTime = undefined;

    this.emit('stateChange', {
      from: CircuitState.HALF_OPEN,
      to: CircuitState.CLOSED,
    });
  }

  private transitionToOpen(): void {
    const previousState = this.state;
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
    this.halfOpenAttempts = 0;

    this.emit('stateChange', {
      from: previousState,
      to: CircuitState.OPEN,
    });

    this.emit('circuitOpen', {
      failureCount: this.failureCount,
      nextAttemptTime: this.nextAttemptTime,
    });
  }

  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenAttempts = 0;

    this.emit('stateChange', {
      from: previousState,
      to: CircuitState.HALF_OPEN,
    });
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      rejectedRequests: this.rejectedRequests,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.nextAttemptTime = undefined;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;

    this.emit('reset');
  }
}