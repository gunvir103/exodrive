#!/usr/bin/env bun
/**
 * Redis Performance Monitoring and Alert Script
 * 
 * This script monitors Redis performance and generates alerts when metrics
 * exceed predefined thresholds. It's designed to be run in CI/CD or as a
 * standalone monitoring tool.
 * 
 * Usage:
 *   bunx scripts/redis-performance-monitor.ts
 *   bunx scripts/redis-performance-monitor.ts --threshold-latency 100
 *   bunx scripts/redis-performance-monitor.ts --generate-report
 *   bunx scripts/redis-performance-monitor.ts --alert-webhook https://hooks.slack.com/...
 */

import { getRedisClient } from "../lib/redis/redis-client";
import { cacheService } from "../lib/redis/cache-service";
import { rateLimiter } from "../lib/rate-limit/rate-limiter";

interface PerformanceMetrics {
  timestamp: string;
  connectivity: {
    status: 'PASS' | 'FAIL' | 'WARN';
    latency_ms: number;
    connection_time_ms: number;
  };
  operations: {
    set_latency_ms: number;
    get_latency_ms: number;
    delete_latency_ms: number;
    invalidate_latency_ms: number;
  };
  throughput: {
    operations_per_second: number;
    concurrent_connections: number;
    rate_limit_checks_per_second: number;
  };
  memory: {
    estimated_usage_mb?: number;
    key_count?: number;
  };
  errors: string[];
  warnings: string[];
  overall_status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}

interface MonitoringConfig {
  thresholds: {
    latency_ms: number;
    operations_per_second_min: number;
    error_rate_max: number;
    memory_usage_mb_max: number;
  };
  alertWebhook?: string;
  generateReport: boolean;
  verbose: boolean;
}

class RedisPerformanceMonitor {
  private config: MonitoringConfig;
  private startTime: number;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.startTime = Date.now();
  }

  async runComprehensiveMonitoring(): Promise<PerformanceMetrics> {
    console.log("🔍 Starting Redis performance monitoring...");
    
    const metrics: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      connectivity: {
        status: 'FAIL',
        latency_ms: 0,
        connection_time_ms: 0
      },
      operations: {
        set_latency_ms: 0,
        get_latency_ms: 0,
        delete_latency_ms: 0,
        invalidate_latency_ms: 0
      },
      throughput: {
        operations_per_second: 0,
        concurrent_connections: 0,
        rate_limit_checks_per_second: 0
      },
      memory: {},
      errors: [],
      warnings: [],
      overall_status: 'CRITICAL'
    };

    try {
      // Test connectivity and latency
      await this.testConnectivity(metrics);
      
      // Test basic operations
      await this.testBasicOperations(metrics);
      
      // Test throughput
      await this.testThroughput(metrics);
      
      // Test rate limiting performance
      await this.testRateLimitingPerformance(metrics);
      
      // Analyze memory usage (if possible)
      await this.analyzeMemoryUsage(metrics);
      
      // Calculate overall status
      this.calculateOverallStatus(metrics);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metrics.errors.push(`Critical monitoring error: ${errorMessage}`);
      metrics.overall_status = 'CRITICAL';
    }

    return metrics;
  }

  private async testConnectivity(metrics: PerformanceMetrics): Promise<void> {
    console.log("🌐 Testing Redis connectivity...");
    
    const connectStart = performance.now();
    try {
      const redis = getRedisClient();
      if (!redis) {
        metrics.errors.push("Redis client not available");
        return;
      }

      const pingStart = performance.now();
      const result = await redis.ping();
      const pingDuration = performance.now() - pingStart;
      
      metrics.connectivity.connection_time_ms = performance.now() - connectStart;
      metrics.connectivity.latency_ms = pingDuration;
      
      if (result === 'PONG') {
        if (pingDuration < this.config.thresholds.latency_ms) {
          metrics.connectivity.status = 'PASS';
        } else {
          metrics.connectivity.status = 'WARN';
          metrics.warnings.push(`High latency: ${pingDuration.toFixed(2)}ms`);
        }
      } else {
        metrics.errors.push(`Unexpected ping response: ${result}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metrics.errors.push(`Connectivity test failed: ${errorMessage}`);
      metrics.connectivity.latency_ms = performance.now() - connectStart;
    }
  }

  private async testBasicOperations(metrics: PerformanceMetrics): Promise<void> {
    console.log("🔧 Testing basic cache operations...");
    
    const testKey = `perf-test-${Date.now()}`;
    const testValue = { 
      test: true, 
      timestamp: Date.now(),
      data: "performance test data".repeat(10) // ~200 bytes
    };

    try {
      // Test SET operation
      const setStart = performance.now();
      await cacheService.set(testKey, testValue, 60);
      metrics.operations.set_latency_ms = performance.now() - setStart;

      // Test GET operation
      const getStart = performance.now();
      const retrieved = await cacheService.get(testKey);
      metrics.operations.get_latency_ms = performance.now() - getStart;

      if (!retrieved) {
        metrics.errors.push("GET operation failed - value not retrieved");
      }

      // Test DELETE operation
      const deleteStart = performance.now();
      await cacheService.delete(testKey);
      metrics.operations.delete_latency_ms = performance.now() - deleteStart;

      // Test INVALIDATE operation
      const invalidateKey = `perf-invalidate-${Date.now()}`;
      await cacheService.set(`${invalidateKey}:1`, testValue, 60);
      await cacheService.set(`${invalidateKey}:2`, testValue, 60);
      
      const invalidateStart = performance.now();
      await cacheService.invalidate(`${invalidateKey}:*`);
      metrics.operations.invalidate_latency_ms = performance.now() - invalidateStart;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metrics.errors.push(`Basic operations test failed: ${errorMessage}`);
    }
  }

  private async testThroughput(metrics: PerformanceMetrics): Promise<void> {
    console.log("⚡ Testing throughput performance...");
    
    const iterations = 100;
    const concurrency = 10;
    const testKeys = Array.from({ length: iterations }, (_, i) => `throughput-test-${i}`);
    
    try {
      const throughputStart = performance.now();
      
      // Batch operations to test throughput
      const batches = [];
      for (let i = 0; i < iterations; i += concurrency) {
        const batch = testKeys.slice(i, i + concurrency).map(async (key) => {
          await cacheService.set(key, { data: `test-${key}` }, 30);
          await cacheService.get(key);
          await cacheService.delete(key);
        });
        batches.push(Promise.all(batch));
      }
      
      await Promise.all(batches);
      
      const throughputDuration = performance.now() - throughputStart;
      const totalOperations = iterations * 3; // set, get, delete
      metrics.throughput.operations_per_second = Math.round(
        (totalOperations / throughputDuration) * 1000
      );
      
      if (metrics.throughput.operations_per_second < this.config.thresholds.operations_per_second_min) {
        metrics.warnings.push(
          `Low throughput: ${metrics.throughput.operations_per_second} ops/sec`
        );
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metrics.errors.push(`Throughput test failed: ${errorMessage}`);
    }
  }

  private async testRateLimitingPerformance(metrics: PerformanceMetrics): Promise<void> {
    console.log("🚦 Testing rate limiting performance...");
    
    try {
      const iterations = 50;
      const testConfig = {
        windowMs: 60000,
        max: 1000,
        keyGenerator: (id: string) => `perf-rate-test:${id}`
      };
      
      const rateLimitStart = performance.now();
      
      const promises = Array.from({ length: iterations }, (_, i) =>
        rateLimiter.checkLimit(`user-${i}`, testConfig)
      );
      
      const results = await Promise.all(promises);
      const rateLimitDuration = performance.now() - rateLimitStart;
      
      metrics.throughput.rate_limit_checks_per_second = Math.round(
        (iterations / rateLimitDuration) * 1000
      );
      
      // Verify all checks passed (they should with high limits)
      const failedChecks = results.filter(r => !r.allowed).length;
      if (failedChecks > 0) {
        metrics.warnings.push(`${failedChecks} rate limit checks failed unexpectedly`);
      }
      
      // Clean up test keys
      await Promise.all(
        Array.from({ length: iterations }, (_, i) =>
          rateLimiter.reset(`user-${i}`, testConfig)
        )
      );
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metrics.errors.push(`Rate limiting test failed: ${errorMessage}`);
    }
  }

  private async analyzeMemoryUsage(metrics: PerformanceMetrics): Promise<void> {
    console.log("💾 Analyzing memory usage...");
    
    try {
      const redis = getRedisClient();
      if (!redis) {
        metrics.warnings.push("Cannot analyze memory - Redis client not available");
        return;
      }

      // Try to get database size (this might not work with all Redis configurations)
      try {
        // Check if the Redis client has an info method
        if (typeof (redis as any).info === 'function') {
          const info = await (redis as any).info('memory');
          if (typeof info === 'string') {
            const memoryMatch = info.match(/used_memory:(\d+)/);
            if (memoryMatch) {
              metrics.memory.estimated_usage_mb = Math.round(parseInt(memoryMatch[1]) / 1024 / 1024);
            }
          }
        } else {
          metrics.warnings.push("INFO command not available in this Redis client");
        }
      } catch (error) {
        // Not all Redis services support INFO command
        metrics.warnings.push("Cannot retrieve memory info from Redis");
      }

      // Try to estimate key count (this might be limited)
      try {
        const keys = await redis.keys('*');
        if (Array.isArray(keys)) {
          metrics.memory.key_count = keys.length;
          
          if (metrics.memory.key_count > 10000) {
            metrics.warnings.push(`High key count: ${metrics.memory.key_count} keys`);
          }
        }
      } catch (error) {
        // KEYS command might be disabled in production
        metrics.warnings.push("Cannot count keys - KEYS command not available");
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metrics.warnings.push(`Memory analysis failed: ${errorMessage}`);
    }
  }

  private calculateOverallStatus(metrics: PerformanceMetrics): void {
    console.log("📊 Calculating overall status...");
    
    if (metrics.errors.length > 0) {
      metrics.overall_status = 'CRITICAL';
      return;
    }
    
    if (metrics.connectivity.status === 'FAIL') {
      metrics.overall_status = 'CRITICAL';
      return;
    }
    
    if (metrics.warnings.length > 0 || 
        metrics.connectivity.status === 'WARN' ||
        metrics.operations.set_latency_ms > this.config.thresholds.latency_ms ||
        metrics.operations.get_latency_ms > this.config.thresholds.latency_ms) {
      metrics.overall_status = 'DEGRADED';
      return;
    }
    
    metrics.overall_status = 'HEALTHY';
  }

  async generateReport(metrics: PerformanceMetrics): Promise<void> {
    if (!this.config.generateReport) return;
    
    console.log("\n📋 Generating performance report...");
    
    const reportPath = `reports/redis-performance-${Date.now()}.json`;
    const htmlReportPath = `reports/redis-performance-${Date.now()}.html`;
    
    // Ensure reports directory exists
    await Bun.write(reportPath, JSON.stringify(metrics, null, 2));
    
    // Generate HTML report
    const htmlReport = this.generateHtmlReport(metrics);
    await Bun.write(htmlReportPath, htmlReport);
    
    console.log(`📄 JSON report saved: ${reportPath}`);
    console.log(`🌐 HTML report saved: ${htmlReportPath}`);
  }

  private generateHtmlReport(metrics: PerformanceMetrics): string {
    const statusColor = {
      'HEALTHY': '#28a745',
      'DEGRADED': '#ffc107', 
      'CRITICAL': '#dc3545'
    }[metrics.overall_status];

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Redis Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; border-left: 5px solid ${statusColor}; }
        .metric-section { margin: 20px 0; padding: 15px; border: 1px solid #dee2e6; border-radius: 5px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
        .metric-value { font-size: 1.5em; font-weight: bold; color: #495057; }
        .metric-label { color: #6c757d; font-size: 0.9em; }
        .status-healthy { color: #28a745; }
        .status-degraded { color: #ffc107; }
        .status-critical { color: #dc3545; }
        .error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; margin: 5px 0; }
        .warning { background: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Redis Performance Report</h1>
        <p><strong>Status:</strong> <span class="status-${metrics.overall_status.toLowerCase()}">${metrics.overall_status}</span></p>
        <p><strong>Generated:</strong> ${metrics.timestamp}</p>
    </div>

    <div class="metric-section">
        <h2>🌐 Connectivity</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${metrics.connectivity.latency_ms.toFixed(2)}ms</div>
                <div class="metric-label">Ping Latency</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.connectivity.connection_time_ms.toFixed(2)}ms</div>
                <div class="metric-label">Connection Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value status-${metrics.connectivity.status.toLowerCase()}">${metrics.connectivity.status}</div>
                <div class="metric-label">Status</div>
            </div>
        </div>
    </div>

    <div class="metric-section">
        <h2>🔧 Operations Performance</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${metrics.operations.set_latency_ms.toFixed(2)}ms</div>
                <div class="metric-label">SET Latency</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.operations.get_latency_ms.toFixed(2)}ms</div>
                <div class="metric-label">GET Latency</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.operations.delete_latency_ms.toFixed(2)}ms</div>
                <div class="metric-label">DELETE Latency</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.operations.invalidate_latency_ms.toFixed(2)}ms</div>
                <div class="metric-label">INVALIDATE Latency</div>
            </div>
        </div>
    </div>

    <div class="metric-section">
        <h2>⚡ Throughput</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${metrics.throughput.operations_per_second}</div>
                <div class="metric-label">Operations/Second</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.throughput.rate_limit_checks_per_second}</div>
                <div class="metric-label">Rate Limit Checks/Second</div>
            </div>
        </div>
    </div>

    ${metrics.memory.estimated_usage_mb || metrics.memory.key_count ? `
    <div class="metric-section">
        <h2>💾 Memory Usage</h2>
        <div class="metric-grid">
            ${metrics.memory.estimated_usage_mb ? `
            <div class="metric-card">
                <div class="metric-value">${metrics.memory.estimated_usage_mb}MB</div>
                <div class="metric-label">Estimated Usage</div>
            </div>
            ` : ''}
            ${metrics.memory.key_count ? `
            <div class="metric-card">
                <div class="metric-value">${metrics.memory.key_count}</div>
                <div class="metric-label">Key Count</div>
            </div>
            ` : ''}
        </div>
    </div>
    ` : ''}

    ${metrics.errors.length > 0 ? `
    <div class="metric-section">
        <h2>❌ Errors</h2>
        ${metrics.errors.map(error => `<div class="error">${error}</div>`).join('')}
    </div>
    ` : ''}

    ${metrics.warnings.length > 0 ? `
    <div class="metric-section">
        <h2>⚠️ Warnings</h2>
        ${metrics.warnings.map(warning => `<div class="warning">${warning}</div>`).join('')}
    </div>
    ` : ''}

    <div class="metric-section">
        <h2>📈 Recommendations</h2>
        ${this.generateRecommendations(metrics).map(rec => `<p>• ${rec}</p>`).join('')}
    </div>
</body>
</html>`;
  }

  private generateRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.connectivity.latency_ms > this.config.thresholds.latency_ms) {
      recommendations.push("Consider optimizing Redis configuration or network connectivity due to high latency");
    }
    
    if (metrics.throughput.operations_per_second < this.config.thresholds.operations_per_second_min) {
      recommendations.push("Throughput is below optimal levels - consider connection pooling or Redis clustering");
    }
    
    if (metrics.memory.key_count && metrics.memory.key_count > 10000) {
      recommendations.push("High key count detected - implement TTL policies and regular cleanup");
    }
    
    if (metrics.errors.length > 0) {
      recommendations.push("Address critical errors before deploying to production");
    }
    
    if (metrics.warnings.length > 2) {
      recommendations.push("Multiple warnings detected - review Redis configuration and monitoring thresholds");
    }
    
    if (recommendations.length === 0) {
      recommendations.push("Redis performance is optimal - maintain current configuration and monitoring");
    }
    
    return recommendations;
  }

  async sendAlert(metrics: PerformanceMetrics): Promise<void> {
    if (!this.config.alertWebhook || metrics.overall_status === 'HEALTHY') {
      return;
    }
    
    console.log("🚨 Sending performance alert...");
    
    const alertPayload = {
      text: `Redis Performance Alert: ${metrics.overall_status}`,
      attachments: [{
        color: metrics.overall_status === 'CRITICAL' ? 'danger' : 'warning',
        fields: [
          {
            title: "Status",
            value: metrics.overall_status,
            short: true
          },
          {
            title: "Latency",
            value: `${metrics.connectivity.latency_ms.toFixed(2)}ms`,
            short: true
          },
          {
            title: "Errors",
            value: metrics.errors.length.toString(),
            short: true
          },
          {
            title: "Warnings", 
            value: metrics.warnings.length.toString(),
            short: true
          }
        ],
        text: metrics.errors.length > 0 ? `Errors: ${metrics.errors.join(', ')}` : undefined
      }]
    };
    
    try {
      const response = await fetch(this.config.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertPayload)
      });
      
      if (response.ok) {
        console.log("✅ Alert sent successfully");
      } else {
        console.error("❌ Failed to send alert:", response.statusText);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("❌ Error sending alert:", errorMessage);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const config: MonitoringConfig = {
  thresholds: {
    latency_ms: 100,
    operations_per_second_min: 1000,
    error_rate_max: 0.01,
    memory_usage_mb_max: 100
  },
  generateReport: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  switch (arg) {
    case "--threshold-latency":
      config.thresholds.latency_ms = parseInt(args[++i]) || 100;
      break;
    case "--threshold-ops":
      config.thresholds.operations_per_second_min = parseInt(args[++i]) || 1000;
      break;
    case "--generate-report":
      config.generateReport = true;
      break;
    case "--alert-webhook":
      config.alertWebhook = args[++i];
      break;
    case "--verbose":
      config.verbose = true;
      break;
    case "--help":
    case "-h":
      console.log(`
Redis Performance Monitor

Usage:
  bunx scripts/redis-performance-monitor.ts [options]

Options:
  --threshold-latency <ms>      Latency threshold in milliseconds (default: 100)
  --threshold-ops <ops>         Minimum operations per second (default: 1000)
  --generate-report            Generate HTML and JSON reports
  --alert-webhook <url>        Webhook URL for alerts (Slack, Discord, etc.)
  --verbose                    Enable verbose output
  --help, -h                   Show this help message

Examples:
  bunx scripts/redis-performance-monitor.ts --generate-report
  bunx scripts/redis-performance-monitor.ts --threshold-latency 50 --alert-webhook https://hooks.slack.com/...
`);
      process.exit(0);
  }
}

// Main execution
async function main() {
  console.log("🚀 Redis Performance Monitor Starting...");
  console.log("📊 Configuration:", JSON.stringify(config, null, 2));
  
  const monitor = new RedisPerformanceMonitor(config);
  
  try {
    const metrics = await monitor.runComprehensiveMonitoring();
    
    console.log("\n📊 Performance Summary:");
    console.log(`Status: ${metrics.overall_status}`);
    console.log(`Latency: ${metrics.connectivity.latency_ms.toFixed(2)}ms`);
    console.log(`Throughput: ${metrics.throughput.operations_per_second} ops/sec`);
    console.log(`Rate Limiting: ${metrics.throughput.rate_limit_checks_per_second} checks/sec`);
    console.log(`Errors: ${metrics.errors.length}`);
    console.log(`Warnings: ${metrics.warnings.length}`);
    
    if (config.verbose) {
      console.log("\n🔍 Detailed Metrics:");
      console.log(JSON.stringify(metrics, null, 2));
    }
    
    // Generate reports if requested
    await monitor.generateReport(metrics);
    
    // Send alerts if configured
    await monitor.sendAlert(metrics);
    
    // Exit with appropriate code
    const exitCode = metrics.overall_status === 'CRITICAL' ? 1 : 
                    metrics.overall_status === 'DEGRADED' ? 2 : 0;
    
    console.log(`\n✅ Monitoring completed with status: ${metrics.overall_status}`);
    process.exit(exitCode);
    
  } catch (error) {
    console.error("❌ Fatal error during performance monitoring:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Monitoring interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Monitoring terminated');
  process.exit(143);
});

// Run the monitor
main();