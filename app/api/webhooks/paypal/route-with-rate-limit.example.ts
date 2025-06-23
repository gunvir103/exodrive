import { NextRequest, NextResponse } from 'next/server';
import { webhookRateLimit } from '@/lib/rate-limit';

// Example of webhook endpoint with rate limiting
export const POST = webhookRateLimit(async (request: NextRequest) => {
  try {
    // Verify webhook signature
    const signature = request.headers.get('paypal-transmission-sig');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Your webhook processing logic here
    const body = await request.json();
    
    // Validate and process webhook...
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
});