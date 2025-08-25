import { SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { ConnectionPoolConfig, DEFAULT_POOL_CONFIG } from './config';

export interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  waitingRequests: number;
  totalRequests: number;
  poolExhaustionCount: number;
  averageWaitTime: number;
  connectionErrors: number;
  lastError?: string;
  lastErrorTime?: Date;
}

export interface ConnectionWrapper {
  client: SupabaseClient;
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  inUse: boolean;
  requestCount: number;
}

export class ConnectionPool extends EventEmitter {
  private connections: Map<string, ConnectionWrapper> = new Map();
  private waitQueue: Array<{
    resolve: (conn: ConnectionWrapper) => void;
    reject: (error: Error) => void;
    startTime: number;
  }> = [];
  
  private metrics: PoolMetrics = {
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
    waitingRequests: 0,
    totalRequests: 0,
    poolExhaustionCount: 0,
    averageWaitTime: 0,
    connectionErrors: 0,
  };
  
  private waitTimes: number[] = [];
  private readonly maxWaitTimeSamples = 100;
  
  constructor(
    private createClient: () => SupabaseClient,
    private config: ConnectionPoolConfig = DEFAULT_POOL_CONFIG
  ) {
    super();
    this.startIdleConnectionCleanup();
  }

  async acquire(): Promise<ConnectionWrapper> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    // Try to get an idle connection
    const idleConnection = this.getIdleConnection();
    if (idleConnection) {
      this.markAsActive(idleConnection);
      this.recordWaitTime(Date.now() - startTime);
      return idleConnection;
    }
    
    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      try {
        const connection = await this.createConnection();
        this.markAsActive(connection);
        this.recordWaitTime(Date.now() - startTime);
        return connection;
      } catch (error) {
        this.metrics.connectionErrors++;
        this.metrics.lastError = error instanceof Error ? error.message : String(error);
        this.metrics.lastErrorTime = new Date();
        throw error;
      }
    }
    
    // Pool exhausted, add to wait queue
    this.metrics.poolExhaustionCount++;
    this.emit('poolExhausted', {
      activeConnections: this.metrics.activeConnections,
      queueLength: this.waitQueue.length,
    });
    
    return new Promise((resolve, reject) => {
      this.waitQueue.push({ resolve, reject, startTime });
      this.metrics.waitingRequests = this.waitQueue.length;
      
      // Timeout waiting for connection
      setTimeout(() => {
        const index = this.waitQueue.findIndex(item => item.startTime === startTime);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
          this.metrics.waitingRequests = this.waitQueue.length;
          reject(new Error(`Connection timeout after ${this.config.connectionTimeout}ms`));
        }
      }, this.config.connectionTimeout);
    });
  }

  release(connection: ConnectionWrapper): void {
    if (!connection.inUse) {
      console.warn(`Connection ${connection.id} was not marked as in use`);
      return;
    }
    
    connection.inUse = false;
    connection.lastUsedAt = new Date();
    this.metrics.activeConnections--;
    this.metrics.idleConnections++;
    
    // Process wait queue
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      this.metrics.waitingRequests = this.waitQueue.length;
      
      connection.inUse = true;
      this.metrics.activeConnections++;
      this.metrics.idleConnections--;
      
      const waitTime = Date.now() - waiter.startTime;
      this.recordWaitTime(waitTime);
      
      waiter.resolve(connection);
    }
    
    this.emit('connectionReleased', {
      connectionId: connection.id,
      activeConnections: this.metrics.activeConnections,
    });
  }

  async destroy(connection: ConnectionWrapper): Promise<void> {
    this.connections.delete(connection.id);
    this.metrics.totalConnections--;
    
    if (connection.inUse) {
      this.metrics.activeConnections--;
    } else {
      this.metrics.idleConnections--;
    }
    
    // Clean up the Supabase client
    try {
      await connection.client.auth.signOut();
    } catch (error) {
      console.error(`Error signing out connection ${connection.id}:`, error);
    }
    
    this.emit('connectionDestroyed', {
      connectionId: connection.id,
      totalConnections: this.metrics.totalConnections,
    });
  }

  async shutdown(): Promise<void> {
    // Reject all waiting requests
    for (const waiter of this.waitQueue) {
      waiter.reject(new Error('Connection pool shutting down'));
    }
    this.waitQueue = [];
    
    // Destroy all connections
    const destroyPromises = Array.from(this.connections.values()).map(conn =>
      this.destroy(conn)
    );
    
    await Promise.all(destroyPromises);
    
    this.emit('poolShutdown');
  }

  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  private getIdleConnection(): ConnectionWrapper | null {
    for (const connection of this.connections.values()) {
      if (!connection.inUse) {
        return connection;
      }
    }
    return null;
  }

  private async createConnection(): Promise<ConnectionWrapper> {
    const id = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const client = this.createClient();
    
    const connection: ConnectionWrapper = {
      client,
      id,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      inUse: false,
      requestCount: 0,
    };
    
    this.connections.set(id, connection);
    this.metrics.totalConnections++;
    this.metrics.idleConnections++;
    
    this.emit('connectionCreated', {
      connectionId: id,
      totalConnections: this.metrics.totalConnections,
    });
    
    return connection;
  }

  private markAsActive(connection: ConnectionWrapper): void {
    connection.inUse = true;
    connection.lastUsedAt = new Date();
    connection.requestCount++;
    this.metrics.activeConnections++;
    this.metrics.idleConnections--;
  }

  private recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > this.maxWaitTimeSamples) {
      this.waitTimes.shift();
    }
    
    const sum = this.waitTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageWaitTime = sum / this.waitTimes.length;
  }

  private startIdleConnectionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const connectionsToDestroy: ConnectionWrapper[] = [];
      
      for (const connection of this.connections.values()) {
        if (!connection.inUse && 
            now - connection.lastUsedAt.getTime() > this.config.idleTimeout) {
          connectionsToDestroy.push(connection);
        }
      }
      
      for (const connection of connectionsToDestroy) {
        this.destroy(connection).catch(error => {
          console.error(`Error destroying idle connection ${connection.id}:`, error);
        });
      }
    }, this.config.idleTimeout / 2);
  }
}