import { getConnectionMetrics, logAllMetrics } from './client-manager';

// Initialize database monitoring on startup
export function initializeDatabaseMonitoring() {
  console.log('🚀 Initializing database connection monitoring...');
  
  // Log metrics every 5 minutes in production
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      const metrics = getConnectionMetrics();
      
      // Check for any issues
      let hasIssues = false;
      const issues: string[] = [];
      
      // Check browser pool
      if (metrics.browser) {
        if (metrics.browser.pool.poolExhaustionCount > 10) {
          hasIssues = true;
          issues.push(`Browser pool exhaustion: ${metrics.browser.pool.poolExhaustionCount} times`);
        }
        if (metrics.browser.circuitBreaker.state === 'OPEN') {
          hasIssues = true;
          issues.push('Browser circuit breaker is OPEN');
        }
      }
      
      // Check server pool
      if (metrics.server) {
        if (metrics.server.pool.poolExhaustionCount > 10) {
          hasIssues = true;
          issues.push(`Server pool exhaustion: ${metrics.server.pool.poolExhaustionCount} times`);
        }
        if (metrics.server.circuitBreaker.state === 'OPEN') {
          hasIssues = true;
          issues.push('Server circuit breaker is OPEN');
        }
      }
      
      // Check service pool
      if (metrics.service) {
        if (metrics.service.pool.poolExhaustionCount > 10) {
          hasIssues = true;
          issues.push(`Service pool exhaustion: ${metrics.service.pool.poolExhaustionCount} times`);
        }
        if (metrics.service.circuitBreaker.state === 'OPEN') {
          hasIssues = true;
          issues.push('Service circuit breaker is OPEN');
        }
      }
      
      // Log issues or status
      if (hasIssues) {
        console.error('⚠️  Database connection issues detected:', issues);
        logAllMetrics();
      } else {
        console.log('✅ Database connections healthy');
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
  
  // Log metrics every minute in development
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      console.log('📊 Database connection metrics:');
      logAllMetrics();
    }, 60 * 1000); // 1 minute
  }
  
  // Set up health check endpoint monitoring
  setupHealthCheckMonitoring();
}

function setupHealthCheckMonitoring() {
  // This would typically be called by your monitoring service
  const checkHealth = async () => {
    const metrics = getConnectionMetrics();
    
    return {
      status: determineHealthStatus(metrics),
      metrics,
      timestamp: new Date().toISOString(),
    };
  };
  
  // Export for use in health check endpoints
  (global as any).getDatabaseHealthStatus = checkHealth;
}

function determineHealthStatus(metrics: ReturnType<typeof getConnectionMetrics>): 'healthy' | 'degraded' | 'unhealthy' {
  let unhealthyCount = 0;
  let degradedCount = 0;
  
  const pools = [metrics.browser, metrics.server, metrics.service];
  
  for (const pool of pools) {
    if (!pool) continue;
    
    // Check for unhealthy conditions
    if (pool.circuitBreaker.state === 'OPEN') {
      unhealthyCount++;
    } else if (pool.pool.connectionErrors > 50) {
      unhealthyCount++;
    }
    
    // Check for degraded conditions
    if (pool.pool.poolExhaustionCount > 5) {
      degradedCount++;
    } else if (pool.pool.averageWaitTime > 1000) {
      degradedCount++;
    } else if (pool.circuitBreaker.state === 'HALF_OPEN') {
      degradedCount++;
    }
  }
  
  if (unhealthyCount > 0) {
    return 'unhealthy';
  } else if (degradedCount > 0) {
    return 'degraded';
  }
  
  return 'healthy';
}

// Auto-initialize if this is imported
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  initializeDatabaseMonitoring();
}