import { SupabaseClientOptions } from '@supabase/supabase-js';

export interface DatabaseConfig {
  url: string;
  anonKey?: string;
  serviceKey?: string;
  options: SupabaseClientOptions<'public'>;
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

// Default connection pool configuration
export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxConnections: 20,
  connectionTimeout: 5000, // 5 seconds
  idleTimeout: 10000, // 10 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5, // 5 consecutive failures
  circuitBreakerTimeout: 60000, // 1 minute
};

// Get database configuration based on client type
export function getDatabaseConfig(
  type: 'anon' | 'service',
  poolConfig: Partial<ConnectionPoolConfig> = {}
): DatabaseConfig {
  const config = { ...DEFAULT_POOL_CONFIG, ...poolConfig };
  
  const baseOptions: SupabaseClientOptions<'public'> = {
    auth: {
      autoRefreshToken: type === 'anon',
      persistSession: type === 'anon',
      detectSessionInUrl: type === 'anon',
    },
    global: {
      fetch: createFetchWithTimeout(config.connectionTimeout),
    },
    db: {
      schema: 'public',
    },
  };

  if (type === 'service') {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    
    return {
      url,
      serviceKey,
      options: baseOptions,
    };
  }

  // Default to anon client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  return {
    url,
    anonKey,
    options: baseOptions,
  };
}

// Create fetch function with timeout
function createFetchWithTimeout(timeout: number): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}