'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RefreshCw, AlertCircle, CheckCircle, Clock, XCircle, Search, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { processWebhookRetries, retryDeadLetterWebhook } from './actions';
import { WebhookDetailDialog } from './webhook-detail-dialog';
import type { WebhookRetryMetric, WebhookDeadLetterItem } from '@/types/webhook';

export default function WebhookMonitoringPage() {
  const [metrics, setMetrics] = useState<WebhookRetryMetric[]>([]);
  const [deadLetterItems, setDeadLetterItems] = useState<WebhookDeadLetterItem[]>([]);
  const [filteredDeadLetterItems, setFilteredDeadLetterItems] = useState<WebhookDeadLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [retryingItems, setRetryingItems] = useState<Set<string>>(new Set());
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookDeadLetterItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [confirmRetryDialog, setConfirmRetryDialog] = useState<{ open: boolean; itemId: string | null }>({ open: false, itemId: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
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
        .limit(50);

      if (deadLetterError) throw deadLetterError;
      setDeadLetterItems(deadLetterData || []);
      setFilteredDeadLetterItems(deadLetterData || []);

    } catch (error: any) {
      console.error('Error fetching webhook data:', error);
      toast.error('Failed to load webhook monitoring data');
    } finally {
      setLoading(false);
    }
  };

  // Filter and search functionality
  useEffect(() => {
    let filtered = [...deadLetterItems];
    
    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.webhook_type === filterType);
    }
    
    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.webhook_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.error_message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.booking_id && item.booking_id.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredDeadLetterItems(filtered);
  }, [deadLetterItems, filterType, searchTerm]);

  useEffect(() => {
    fetchData();
    // Auto-refresh
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchData, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

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
      setRetryingItems(prev => new Set(prev).add(itemId));
      const result = await retryDeadLetterWebhook(itemId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to retry webhook');
      }

      toast.success(result.message || 'Webhook queued for retry');
      await fetchData();
    } catch (error: any) {
      console.error('Error retrying dead letter item:', error);
      toast.error(error.message || 'Failed to retry webhook');
    } finally {
      setRetryingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      setConfirmRetryDialog({ open: false, itemId: null });
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Type', 'Status', 'Count', 'Avg Attempts', 'Max Attempts', 'Oldest', 'Newest'].join(','),
      ...metrics.map(m => [
        m.webhook_type,
        m.status,
        m.count,
        m.avg_attempts.toFixed(2),
        m.max_attempts,
        new Date(m.oldest_retry).toISOString(),
        new Date(m.newest_retry).toISOString()
      ].join(','))
    ].join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhook-metrics-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Metrics exported successfully');
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

  if (loading && metrics.length === 0) {
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
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant="outline"
            size="sm"
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button
            onClick={exportData}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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
            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by webhook ID, booking ID, or error message..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="resend">Resend</SelectItem>
                  <SelectItem value="docuseal">DocuSeal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Items */}
            <div className="space-y-2">
              {filteredDeadLetterItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items found matching your filters
                </p>
              ) : (
                filteredDeadLetterItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors">
                    <div className="space-y-1 flex-1">
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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedWebhook(item);
                          setDetailDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmRetryDialog({ open: true, itemId: item.id })}
                        disabled={retryingItems.has(item.id)}
                      >
                        {retryingItems.has(item.id) ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Retry'
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook Detail Dialog */}
      <WebhookDetailDialog 
        webhook={selectedWebhook}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      {/* Retry Confirmation Dialog */}
      <AlertDialog 
        open={confirmRetryDialog.open} 
        onOpenChange={(open) => setConfirmRetryDialog({ open, itemId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Failed Webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This will queue the webhook for retry. It will be processed according to the standard retry schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmRetryDialog.itemId && retryDeadLetterItem(confirmRetryDialog.itemId)}
            >
              Retry Webhook
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}