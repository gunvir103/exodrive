'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WebhookHealth } from '../webhook-health';
import { WebhookHistory } from '../webhook-history';
import WebhookMonitoringPage from '../page';

export default function WebhookDashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Webhook Management Dashboard</h1>
      
      <Tabs defaultValue="monitoring" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="monitoring" className="space-y-4">
          <WebhookMonitoringPage />
        </TabsContent>
        
        <TabsContent value="health" className="space-y-4">
          <WebhookHealth />
        </TabsContent>
        
        <TabsContent value="history" className="space-y-4">
          <WebhookHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}