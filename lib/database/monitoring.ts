import { ConnectionPool, PoolMetrics } from './connection-pool';
import { CircuitBreaker, CircuitBreakerMetrics } from './circuit-breaker';
import { EventEmitter } from 'events';

export interface DatabaseMetrics {
  pool: PoolMetrics;
  circuitBreaker: CircuitBreakerMetrics;
  timestamp: Date;
}

export interface MonitoringConfig {
  enableLogging: boolean;
  metricsInterval: number; // milliseconds
  alertThresholds: {
    poolExhaustion: number;
    connectionErrors: number;
    circuitBreakerOpen: boolean;
    highWaitTime: number; // milliseconds
  };
}

export class DatabaseMonitor extends EventEmitter {
  private metrics: DatabaseMetrics[] = [];
  private metricsInterval?: NodeJS.Timeout;
  private alertCounts = {
    poolExhaustion: 0,
    connectionErrors: 0,
    circuitBreakerOpen: 0,
    highWaitTime: 0,
  };

  constructor(
    private pool: ConnectionPool,
    private circuitBreaker: CircuitBreaker,
    private config: MonitoringConfig
  ) {
    super();
    this.setupEventListeners();
    this.startMetricsCollection();
  }

  private setupEventListeners(): void {
    // Connection pool events
    this.pool.on('poolExhausted', (data) => {
      this.alertCounts.poolExhaustion++;
      if (this.config.enableLogging) {
        console.warn('[DatabaseMonitor] Pool exhausted:', data);
      }
      this.emit('alert', {
        type: 'poolExhausted',
        data,
        count: this.alertCounts.poolExhaustion,
      });
    });

    this.pool.on('connectionCreated', (data) => {
      if (this.config.enableLogging) {
        console.log('[DatabaseMonitor] Connection created:', data);
      }
    });

    this.pool.on('connectionDestroyed', (data) => {
      if (this.config.enableLogging) {
        console.log('[DatabaseMonitor] Connection destroyed:', data);
      }
    });

    // Circuit breaker events
    this.circuitBreaker.on('stateChange', (data) => {
      if (this.config.enableLogging) {
        console.log('[DatabaseMonitor] Circuit breaker state change:', data);
      }
      
      if (data.to === 'OPEN') {
        this.alertCounts.circuitBreakerOpen++;
        this.emit('alert', {
          type: 'circuitBreakerOpen',
          data,
          count: this.alertCounts.circuitBreakerOpen,
        });
      }
    });

    this.circuitBreaker.on('requestRejected', (data) => {
      if (this.config.enableLogging) {
        console.warn('[DatabaseMonitor] Request rejected by circuit breaker:', data);
      }
    });
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const poolMetrics = this.pool.getMetrics();
      const circuitMetrics = this.circuitBreaker.getMetrics();
      
      const metrics: DatabaseMetrics = {
        pool: poolMetrics,
        circuitBreaker: circuitMetrics,
        timestamp: new Date(),
      };
      
      this.metrics.push(metrics);
      
      // Keep only last 1000 metrics
      if (this.metrics.length > 1000) {
        this.metrics.shift();
      }
      
      // Check alerts
      this.checkAlerts(metrics);
      
      // Emit metrics event
      this.emit('metrics', metrics);
    }, this.config.metricsInterval);
  }

  private checkAlerts(metrics: DatabaseMetrics): void {
    // Check pool exhaustion
    if (metrics.pool.poolExhaustionCount >= this.config.alertThresholds.poolExhaustion) {
      this.emit('alert', {
        type: 'poolExhaustionThreshold',
        message: `Pool exhaustion count (${metrics.pool.poolExhaustionCount}) exceeds threshold (${this.config.alertThresholds.poolExhaustion})`,
        metrics,
      });
    }

    // Check connection errors
    if (metrics.pool.connectionErrors >= this.config.alertThresholds.connectionErrors) {
      this.emit('alert', {
        type: 'connectionErrorsThreshold',
        message: `Connection errors (${metrics.pool.connectionErrors}) exceeds threshold (${this.config.alertThresholds.connectionErrors})`,
        metrics,
      });
    }

    // Check high wait time
    if (metrics.pool.averageWaitTime >= this.config.alertThresholds.highWaitTime) {
      this.alertCounts.highWaitTime++;
      this.emit('alert', {
        type: 'highWaitTime',
        message: `Average wait time (${metrics.pool.averageWaitTime}ms) exceeds threshold (${this.config.alertThresholds.highWaitTime}ms)`,
        metrics,
        count: this.alertCounts.highWaitTime,
      });
    }
  }

  getMetrics(): DatabaseMetrics[] {
    return [...this.metrics];
  }

  getLatestMetrics(): DatabaseMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsSummary(duration: number = 60000): {
    avgActiveConnections: number;
    avgWaitTime: number;
    totalRequests: number;
    totalErrors: number;
    circuitBreakerOpenCount: number;
  } {
    const cutoff = Date.now() - duration;
    const relevantMetrics = this.metrics.filter(m => m.timestamp.getTime() >= cutoff);
    
    if (relevantMetrics.length === 0) {
      return {
        avgActiveConnections: 0,
        avgWaitTime: 0,
        totalRequests: 0,
        totalErrors: 0,
        circuitBreakerOpenCount: 0,
      };
    }

    const avgActiveConnections = relevantMetrics.reduce((sum, m) => sum + m.pool.activeConnections, 0) / relevantMetrics.length;
    const avgWaitTime = relevantMetrics.reduce((sum, m) => sum + m.pool.averageWaitTime, 0) / relevantMetrics.length;
    const totalRequests = relevantMetrics[relevantMetrics.length - 1].pool.totalRequests - relevantMetrics[0].pool.totalRequests;
    const totalErrors = relevantMetrics[relevantMetrics.length - 1].pool.connectionErrors - relevantMetrics[0].pool.connectionErrors;
    const circuitBreakerOpenCount = relevantMetrics.filter(m => m.circuitBreaker.state === 'OPEN').length;

    return {
      avgActiveConnections,
      avgWaitTime,
      totalRequests,
      totalErrors,
      circuitBreakerOpenCount,
    };
  }

  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  // Log metrics to console in a formatted way
  logMetricsSummary(): void {
    const summary = this.getMetricsSummary();
    const latest = this.getLatestMetrics();
    
    console.log('\n=== Database Connection Metrics ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    
    if (latest) {
      console.log('\nConnection Pool:');
      console.log(`  Active Connections: ${latest.pool.activeConnections}/${this.config.alertThresholds.poolExhaustion}`);
      console.log(`  Idle Connections: ${latest.pool.idleConnections}`);
      console.log(`  Waiting Requests: ${latest.pool.waitingRequests}`);
      console.log(`  Pool Exhaustion Count: ${latest.pool.poolExhaustionCount}`);
      
      console.log('\nCircuit Breaker:');
      console.log(`  State: ${latest.circuitBreaker.state}`);
      console.log(`  Failure Count: ${latest.circuitBreaker.failureCount}`);
      console.log(`  Success Count: ${latest.circuitBreaker.successCount}`);
    }
    
    console.log('\nLast Minute Summary:');
    console.log(`  Avg Active Connections: ${summary.avgActiveConnections.toFixed(2)}`);
    console.log(`  Avg Wait Time: ${summary.avgWaitTime.toFixed(2)}ms`);
    console.log(`  Total Requests: ${summary.totalRequests}`);
    console.log(`  Total Errors: ${summary.totalErrors}`);
    console.log(`  Circuit Breaker Open Count: ${summary.circuitBreakerOpenCount}`);
    console.log('================================\n');
  }
}