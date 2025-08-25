'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { WebhookRetryMetric } from '@/types/webhook';

export function WebhookHealth() {
  const [metrics, setMetrics] = useState<WebhookRetryMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data, error } = await supabase
          .from('webhook_retry_metrics')
          .select('*');
        
        if (error) throw error;
        setMetrics(data || []);
      } catch (error) {
        console.error('Error fetching webhook health metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Webhook Health</CardTitle>
          <CardDescription>Loading health metrics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Calculate health metrics
  const calculateHealthScore = (typeMetrics: WebhookRetryMetric[]) => {
    const total = typeMetrics.reduce((sum, m) => sum + m.count, 0);
    const succeeded = typeMetrics.find(m => m.status === 'succeeded')?.count || 0;
    const deadLetter = typeMetrics.find(m => m.status === 'dead_letter')?.count || 0;
    
    if (total === 0) return 100;
    
    const successRate = (succeeded / total) * 100;
    const failureRate = (deadLetter / total) * 100;
    
    // Health score calculation: 100 - (failure rate * 2) + (success rate * 0.5)
    const score = Math.max(0, Math.min(100, 100 - (failureRate * 2) + (successRate * 0.5)));
    
    return Math.round(score);
  };

  const getHealthStatus = (score: number) => {
    if (score >= 90) return { label: 'Healthy', color: 'success', icon: CheckCircle2 };
    if (score >= 70) return { label: 'Warning', color: 'warning', icon: AlertTriangle };
    return { label: 'Critical', color: 'destructive', icon: XCircle };
  };

  const webhookTypes = ['paypal', 'resend', 'docuseal'];

  return (
    <div className="space-y-6">
      {/* Overall Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Health Dashboard</CardTitle>
          <CardDescription>Monitor the health and performance of webhook processing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {webhookTypes.map(type => {
              const typeMetrics = metrics.filter(m => m.webhook_type === type);
              const healthScore = calculateHealthScore(typeMetrics);
              const status = getHealthStatus(healthScore);
              const StatusIcon = status.icon;
              
              const total = typeMetrics.reduce((sum, m) => sum + m.count, 0);
              const succeeded = typeMetrics.find(m => m.status === 'succeeded')?.count || 0;
              const pending = typeMetrics.find(m => m.status === 'pending')?.count || 0;
              const deadLetter = typeMetrics.find(m => m.status === 'dead_letter')?.count || 0;
              
              return (
                <Card key={type}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg capitalize">{type}</CardTitle>
                      <Badge variant={status.color as any}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{healthScore}%</span>
                      <span className="text-sm text-muted-foreground">Health Score</span>
                    </div>
                    
                    <Progress value={healthScore} className="h-2" />
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-medium">{total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-600">Succeeded</span>
                        <span className="font-medium">{succeeded}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yellow-600">Pending</span>
                        <span className="font-medium">{pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-600">Dead Letter</span>
                        <span className="font-medium">{deadLetter}</span>
                      </div>
                    </div>
                    
                    {deadLetter > 0 && (
                      <Alert variant="destructive" className="mt-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {deadLetter} webhook{deadLetter > 1 ? 's' : ''} failed permanently
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Alerts and Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts & Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {webhookTypes.map(type => {
            const typeMetrics = metrics.filter(m => m.webhook_type === type);
            const deadLetter = typeMetrics.find(m => m.status === 'dead_letter')?.count || 0;
            const pending = typeMetrics.find(m => m.status === 'pending')?.count || 0;
            const avgAttempts = typeMetrics.reduce((sum, m) => sum + (m.avg_attempts * m.count), 0) / 
                               typeMetrics.reduce((sum, m) => sum + m.count, 0) || 0;
            
            const alerts = [];
            
            if (deadLetter > 5) {
              alerts.push({
                level: 'error',
                message: `${deadLetter} ${type} webhooks have failed permanently. Manual investigation required.`
              });
            }
            
            if (pending > 10) {
              alerts.push({
                level: 'warning',
                message: `${pending} ${type} webhooks are pending retry. Consider running manual retry process.`
              });
            }
            
            if (avgAttempts > 3) {
              alerts.push({
                level: 'warning',
                message: `${type} webhooks averaging ${avgAttempts.toFixed(1)} attempts. Check endpoint reliability.`
              });
            }
            
            return alerts.map((alert, index) => (
              <Alert key={`${type}-${index}`} variant={alert.level === 'error' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="capitalize">{type}</AlertTitle>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            ));
          })}
          
          {metrics.length === 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>All Clear</AlertTitle>
              <AlertDescription>
                No webhook issues detected. All systems operating normally.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}