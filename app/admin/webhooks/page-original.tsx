'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { processWebhookRetries, retryDeadLetterWebhook } from './actions';
import type { WebhookRetryMetric, WebhookDeadLetterItem } from '@/types/webhook';

export default function WebhookMonitoringPage() {
  const [metrics, setMetrics] = useState<WebhookRetryMetric[]>([]);
  const [deadLetterItems, setDeadLetterItems] = useState<WebhookDeadLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const supabase = getSupabaseBrowserClient();

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('webhook_retry_metrics')
        .select('*');

      if (metricsError) throw metricsError;
      setMetrics(metricsData || []);

      // Fetch dead letter queue items
      const { data: deadLetterData, error: deadLetterError } = await supabase
        .from('webhook_dead_letter_queue')
        .select('*')
        .limit(20);

      if (deadLetterError) throw deadLetterError;
      setDeadLetterItems(deadLetterData || []);

    } catch (error: any) {
      console.error('Error fetching webhook data:', error);
      toast.error('Failed to load webhook monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const processRetries = async () => {
    try {
      setProcessing(true);
      const result = await processWebhookRetries();

      if (!result.success) {
        throw new Error(result.error || 'Failed to process retries');
      }

      toast.success(`Processed ${result.results.processed} webhooks: ${result.results.succeeded} succeeded, ${result.results.retrying} retrying`);
      
      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error('Error processing retries:', error);
      toast.error(error.message || 'Failed to process webhook retries');
    } finally {
      setProcessing(false);
    }
  };

  const retryDeadLetterItem = async (itemId: string) => {
    try {
      const result = await retryDeadLetterWebhook(itemId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to retry webhook');
      }

      toast.success(result.message || 'Webhook queued for retry');
      await fetchData();
    } catch (error: any) {
      console.error('Error retrying dead letter item:', error);
      toast.error(error.message || 'Failed to retry webhook');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'succeeded':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
      case 'dead_letter':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'processing':
        return 'default';
      case 'succeeded':
        return 'success';
      case 'failed':
      case 'dead_letter':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Calculate summary stats
  const totalPending = metrics.filter(m => m.status === 'pending').reduce((sum, m) => sum + m.count, 0);
  const totalProcessing = metrics.filter(m => m.status === 'processing').reduce((sum, m) => sum + m.count, 0);
  const totalDeadLetter = metrics.filter(m => m.status === 'dead_letter').reduce((sum, m) => sum + m.count, 0);
  const totalSucceeded = metrics.filter(m => m.status === 'succeeded').reduce((sum, m) => sum + m.count, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Webhook Monitoring</h1>
        <div className="flex gap-2">
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={processRetries}
            disabled={processing || totalPending === 0}
            size="sm"
          >
            {processing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Process Retries ({totalPending})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPending}</div>
            <p className="text-xs text-muted-foreground">Waiting to be retried</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProcessing}</div>
            <p className="text-xs text-muted-foreground">Currently being processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Succeeded</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSucceeded}</div>
            <p className="text-xs text-muted-foreground">Successfully retried</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dead Letter</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeadLetter}</div>
            <p className="text-xs text-muted-foreground">Failed permanently</p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Metrics by Type</CardTitle>
          <CardDescription>Breakdown of webhook retries by provider and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['paypal', 'resend', 'docuseal'].map(type => {
              const typeMetrics = metrics.filter(m => m.webhook_type === type);
              if (typeMetrics.length === 0) return null;

              return (
                <div key={type} className="space-y-2">
                  <h3 className="font-semibold capitalize">{type}</h3>
                  <div className="grid gap-2 md:grid-cols-4">
                    {typeMetrics.map(metric => (
                      <div key={`${type}-${metric.status}`} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(metric.status)}
                          <span className="text-sm capitalize">{metric.status}</span>
                        </div>
                        <Badge variant={getStatusColor(metric.status) as any}>
                          {metric.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dead Letter Queue */}
      {deadLetterItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dead Letter Queue</CardTitle>
            <CardDescription>Webhooks that have failed permanently after maximum retries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deadLetterItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.webhook_type}</Badge>
                      <span className="text-sm font-mono">{item.webhook_id}</span>
                      {item.booking_id && (
                        <span className="text-sm text-muted-foreground">
                          Booking: {item.booking_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Failed after {item.attempt_count} attempts • {new Date(item.failed_permanently_at).toLocaleString()}
                    </div>
                    <div className="text-sm text-destructive">{item.error_message}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retryDeadLetterItem(item.id)}
                  >
                    Retry
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}