'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WebhookDeadLetterItem } from '@/types/webhook';

interface WebhookDetailDialogProps {
  webhook: WebhookDeadLetterItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WebhookDetailDialog({ webhook, open, onOpenChange }: WebhookDetailDialogProps) {
  if (!webhook) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Webhook Details</DialogTitle>
          <DialogDescription>
            View the full webhook payload and error details
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Webhook Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Webhook ID</p>
              <p className="font-mono text-sm">{webhook.webhook_id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <Badge variant="outline">{webhook.webhook_type}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Attempts</p>
              <p className="text-sm">{webhook.attempt_count}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Failed At</p>
              <p className="text-sm">{new Date(webhook.failed_permanently_at).toLocaleString()}</p>
            </div>
          </div>

          {/* Error Message */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Error Message</p>
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{webhook.error_message}</p>
            </div>
          </div>

          {/* Payload */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Payload</p>
            <ScrollArea className="h-[300px] w-full border rounded-md p-4">
              <pre className="text-xs">
                {JSON.stringify(webhook.payload, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}