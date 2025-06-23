import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, createBrowserClient } from '@supabase/ssr';
import { ConnectionPool, ConnectionWrapper } from './connection-pool';
import { CircuitBreaker } from './circuit-breaker';
import { DatabaseMonitor } from './monitoring';
import { getDatabaseConfig, ConnectionPoolConfig, DEFAULT_POOL_CONFIG } from './config';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

// Singleton instances
let browserPool: ConnectionPool | null = null;
let serverPool: ConnectionPool | null = null;
let servicePool: ConnectionPool | null = null;

let browserCircuitBreaker: CircuitBreaker | null = null;
let serverCircuitBreaker: CircuitBreaker | null = null;
let serviceCircuitBreaker: CircuitBreaker | null = null;

let browserMonitor: DatabaseMonitor | null = null;
let serverMonitor: DatabaseMonitor | null = null;
let serviceMonitor: DatabaseMonitor | null = null;

// Graceful shutdown flag
let isShuttingDown = false;

export interface DatabaseClient {
  client: SupabaseClient;
  release: () => void;
}

// Browser client with connection pooling
export async function getPooledBrowserClient(): Promise<DatabaseClient> {
  if (isShuttingDown) {
    throw new Error('Database connections are shutting down');
  }

  if (!browserPool) {
    const config = getDatabaseConfig('anon');
    
    browserPool = new ConnectionPool(
      () => createBrowserClient(config.url, config.anonKey!, config.options),
      DEFAULT_POOL_CONFIG
    );

    browserCircuitBreaker = new CircuitBreaker({
      failureThreshold: DEFAULT_POOL_CONFIG.circuitBreakerThreshold,
      resetTimeout: DEFAULT_POOL_CONFIG.circuitBreakerTimeout,
      monitoringPeriod: 60000,
      halfOpenRetries: 3,
    });

    browserMonitor = new DatabaseMonitor(
      browserPool,
      browserCircuitBreaker,
      {
        enableLogging: process.env.NODE_ENV === 'development',
        metricsInterval: 10000,
        alertThresholds: {
          poolExhaustion: DEFAULT_POOL_CONFIG.maxConnections,
          connectionErrors: 10,
          circuitBreakerOpen: true,
          highWaitTime: 1000,
        },
      }
    );
  }

  const connection = await browserCircuitBreaker!.execute(() => browserPool!.acquire());
  
  return {
    client: connection.client,
    release: () => browserPool!.release(connection),
  };
}

// Server client with connection pooling
export async function getPooledServerClient(
  cookieStore: ReadonlyRequestCookies
): Promise<DatabaseClient> {
  if (isShuttingDown) {
    throw new Error('Database connections are shutting down');
  }

  if (!serverPool) {
    const config = getDatabaseConfig('anon');
    
    serverPool = new ConnectionPool(
      () => createServerClient(
        config.url,
        config.anonKey!,
        {
          ...config.options,
          cookies: {
            get: async (name: string) => {
              try {
                const cookie = await cookieStore.get(name);
                return cookie?.value;
              } catch (error) {
                console.error(`Error getting cookie '${name}':`, error);
                return undefined;
              }
            },
            set: async (name: string, value: string, options) => {
              try {
                await cookieStore.set({ name, value, ...options });
              } catch (error) {
                // Ignore errors in Server Components
              }
            },
            remove: async (name: string, options) => {
              try {
                await cookieStore.set({ name, value: '', ...options });
              } catch (error) {
                // Ignore errors in Server Components
              }
            },
          },
        }
      ),
      DEFAULT_POOL_CONFIG
    );

    serverCircuitBreaker = new CircuitBreaker({
      failureThreshold: DEFAULT_POOL_CONFIG.circuitBreakerThreshold,
      resetTimeout: DEFAULT_POOL_CONFIG.circuitBreakerTimeout,
      monitoringPeriod: 60000,
      halfOpenRetries: 3,
    });

    serverMonitor = new DatabaseMonitor(
      serverPool,
      serverCircuitBreaker,
      {
        enableLogging: process.env.NODE_ENV === 'development',
        metricsInterval: 10000,
        alertThresholds: {
          poolExhaustion: DEFAULT_POOL_CONFIG.maxConnections,
          connectionErrors: 10,
          circuitBreakerOpen: true,
          highWaitTime: 1000,
        },
      }
    );
  }

  const connection = await serverCircuitBreaker!.execute(() => serverPool!.acquire());
  
  return {
    client: connection.client,
    release: () => serverPool!.release(connection),
  };
}

// Service role client with connection pooling
export async function getPooledServiceClient(): Promise<DatabaseClient> {
  if (isShuttingDown) {
    throw new Error('Database connections are shutting down');
  }

  if (!servicePool) {
    const config = getDatabaseConfig('service');
    
    servicePool = new ConnectionPool(
      () => createClient(config.url, config.serviceKey!, config.options),
      DEFAULT_POOL_CONFIG
    );

    serviceCircuitBreaker = new CircuitBreaker({
      failureThreshold: DEFAULT_POOL_CONFIG.circuitBreakerThreshold,
      resetTimeout: DEFAULT_POOL_CONFIG.circuitBreakerTimeout,
      monitoringPeriod: 60000,
      halfOpenRetries: 3,
    });

    serviceMonitor = new DatabaseMonitor(
      servicePool,
      serviceCircuitBreaker,
      {
        enableLogging: process.env.NODE_ENV === 'development',
        metricsInterval: 10000,
        alertThresholds: {
          poolExhaustion: DEFAULT_POOL_CONFIG.maxConnections,
          connectionErrors: 10,
          circuitBreakerOpen: true,
          highWaitTime: 1000,
        },
      }
    );
  }

  const connection = await serviceCircuitBreaker!.execute(() => servicePool!.acquire());
  
  return {
    client: connection.client,
    release: () => servicePool!.release(connection),
  };
}

// Execute with automatic connection management
export async function executeWithConnection<T>(
  operation: (client: SupabaseClient) => Promise<T>,
  clientType: 'browser' | 'service' = 'browser',
  cookieStore?: ReadonlyRequestCookies
): Promise<T> {
  let dbClient: DatabaseClient | null = null;
  
  try {
    if (clientType === 'service') {
      dbClient = await getPooledServiceClient();
    } else if (cookieStore) {
      dbClient = await getPooledServerClient(cookieStore);
    } else {
      dbClient = await getPooledBrowserClient();
    }
    
    return await operation(dbClient.client);
  } finally {
    if (dbClient) {
      dbClient.release();
    }
  }
}

// Get monitoring metrics
export function getConnectionMetrics() {
  return {
    browser: browserMonitor?.getLatestMetrics() || null,
    server: serverMonitor?.getLatestMetrics() || null,
    service: serviceMonitor?.getLatestMetrics() || null,
  };
}

// Log all metrics
export function logAllMetrics(): void {
  console.log('\n=== ALL DATABASE CONNECTION METRICS ===');
  
  if (browserMonitor) {
    console.log('\n--- Browser Pool ---');
    browserMonitor.logMetricsSummary();
  }
  
  if (serverMonitor) {
    console.log('\n--- Server Pool ---');
    serverMonitor.logMetricsSummary();
  }
  
  if (serviceMonitor) {
    console.log('\n--- Service Pool ---');
    serviceMonitor.logMetricsSummary();
  }
}

// Graceful shutdown
export async function shutdownDatabaseConnections(): Promise<void> {
  console.log('Starting graceful database shutdown...');
  isShuttingDown = true;
  
  const shutdownPromises: Promise<void>[] = [];
  
  if (browserMonitor) {
    browserMonitor.stop();
  }
  if (serverMonitor) {
    serverMonitor.stop();
  }
  if (serviceMonitor) {
    serviceMonitor.stop();
  }
  
  if (browserPool) {
    shutdownPromises.push(browserPool.shutdown());
  }
  if (serverPool) {
    shutdownPromises.push(serverPool.shutdown());
  }
  if (servicePool) {
    shutdownPromises.push(servicePool.shutdown());
  }
  
  await Promise.all(shutdownPromises);
  
  console.log('Database connections shut down successfully');
}

// Register shutdown handlers
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await shutdownDatabaseConnections();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    await shutdownDatabaseConnections();
    process.exit(0);
  });
}