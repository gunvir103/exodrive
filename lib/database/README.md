# Database Connection Pooling Configuration

This directory contains the database connection pooling infrastructure for the Exodrive application.

## Overview

The connection pooling system provides:
- **Connection Pool Management**: Limits concurrent database connections (max 20)
- **Circuit Breaker Pattern**: Prevents cascading failures
- **Connection Monitoring**: Tracks metrics and alerts on issues
- **Automatic Retry Logic**: Handles transient failures gracefully
- **Graceful Shutdown**: Properly closes connections on app termination

## Key Components

### 1. Configuration (`config.ts`)
- Default pool settings (max connections, timeouts)
- Database client configuration
- Environment-based setup

### 2. Connection Pool (`connection-pool.ts`)
- Manages a pool of reusable database connections
- Tracks metrics (active/idle connections, wait times)
- Handles connection lifecycle

### 3. Circuit Breaker (`circuit-breaker.ts`)
- Implements circuit breaker pattern
- Three states: CLOSED (normal), OPEN (failing), HALF_OPEN (testing)
- Prevents overwhelming a failing database

### 4. Monitoring (`monitoring.ts`)
- Real-time metrics collection
- Alert thresholds and notifications
- Health status reporting

### 5. Client Manager (`client-manager.ts`)
- Main entry point for getting database connections
- Integrates all components
- Provides both pooled and legacy interfaces

## Usage

### Recommended: Automatic Connection Management

```typescript
import { withSupabaseClient } from '@/lib/supabase/client';

// Browser client
const userData = await withSupabaseClient(async (supabase) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .single();
  
  if (error) throw error;
  return data;
});

// Service client (admin operations)
import { withServiceClient } from '@/lib/supabase/client';

await withServiceClient(async (supabase) => {
  await supabase.auth.admin.deleteUser(userId);
});
```

### Manual Connection Management (Use Sparingly)

```typescript
import { getPooledSupabaseClient } from '@/lib/supabase/client';

const dbClient = await getPooledSupabaseClient();
try {
  // Use dbClient.client for operations
  const { data } = await dbClient.client.from('cars').select('*');
  return data;
} finally {
  // CRITICAL: Always release the connection
  dbClient.release();
}
```

## Configuration

Environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Public Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anonymous key
- `SUPABASE_URL`: Server-side Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations

Default pool configuration:
- Max Connections: 20
- Connection Timeout: 5 seconds
- Idle Timeout: 10 seconds
- Retry Attempts: 3
- Circuit Breaker Threshold: 5 consecutive failures

## Monitoring

### Metrics Endpoint
Access database metrics at: `/api/admin/database-metrics`

### Automatic Monitoring
- Production: Logs metrics every 5 minutes
- Development: Logs metrics every minute
- Alerts on: pool exhaustion, connection errors, circuit breaker open

### Health Status
Three states:
- `healthy`: All systems normal
- `degraded`: Some issues but operational
- `unhealthy`: Critical issues detected

## Migration Guide

To migrate existing code to use pooled connections:

1. Run the migration script (dry run):
   ```bash
   bun run scripts/migrate-to-pooled-connections.ts
   ```

2. Apply changes:
   ```bash
   bun run scripts/migrate-to-pooled-connections.ts --apply
   ```

3. Manually update code to:
   - Add proper error handling
   - Ensure connections are released in finally blocks
   - Use the `with*` helper functions where possible

## Best Practices

1. **Always use the `with*` helper functions** when possible
2. **Release connections promptly** to avoid pool exhaustion
3. **Monitor metrics** regularly in production
4. **Handle errors gracefully** - connections are released even on error
5. **Avoid long-running operations** that hold connections

## Troubleshooting

### Pool Exhaustion
- Check for unreleased connections
- Review long-running queries
- Increase pool size if needed (carefully)

### Circuit Breaker Open
- Check database health
- Review recent errors
- Circuit will auto-reset after timeout

### High Wait Times
- Indicates pool pressure
- Review concurrent usage patterns
- Consider optimizing queries