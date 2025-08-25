'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { WebhookRetry, WebhookRetryStatus } from '@/types/webhook';

interface WebhookHistoryProps {
  bookingId?: string;
}

export function WebhookHistory({ bookingId }: WebhookHistoryProps) {
  const [webhooks, setWebhooks] = useState<WebhookRetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<WebhookRetryStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const supabase = getSupabaseBrowserClient();

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('webhook_retries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (bookingId) {
        query = query.eq('booking_id', bookingId);
      }
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      if (typeFilter !== 'all') {
        query = query.eq('webhook_type', typeFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setWebhooks(data || []);
      
    } catch (error: any) {
      console.error('Error fetching webhook history:', error);
      toast.error('Failed to load webhook history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, [statusFilter, typeFilter, bookingId]);

  const getStatusIcon = (status: WebhookRetryStatus) => {
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

  const getStatusColor = (status: WebhookRetryStatus) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook History</CardTitle>
        <CardDescription>
          View all webhook activity {bookingId && 'for this booking'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as WebhookRetryStatus | 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="dead_letter">Dead Letter</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
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
          
          <Button
            onClick={fetchWebhooks}
            variant="outline"
            size="sm"
            className="ml-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Webhook ID</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Next Retry</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : webhooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No webhooks found
                  </TableCell>
                </TableRow>
              ) : (
                webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>
                      <Badge variant={getStatusColor(webhook.status) as any} className="flex items-center gap-1 w-fit">
                        {getStatusIcon(webhook.status)}
                        {webhook.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{webhook.webhook_type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {webhook.webhook_id}
                    </TableCell>
                    <TableCell>
                      {webhook.attempt_count}/{webhook.max_attempts}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(webhook.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {webhook.next_retry_at ? new Date(webhook.next_retry_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-destructive max-w-xs truncate">
                      {webhook.error_message || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}