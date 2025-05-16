import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';

const RESEND_WEBHOOK_SIGNING_SECRET = process.env.RESEND_WEBHOOK_SIGNING_SECRET;

export async function POST(request: NextRequest) {
  if (!RESEND_WEBHOOK_SIGNING_SECRET) {
    console.error('RESEND_WEBHOOK_SIGNING_SECRET is not set');
    return NextResponse.json({ success: false, message: 'Server configuration error' }, { status: 500 });
  }

  try {
    // IMPORTANT: Get raw body for webhook verification
    const rawBody = await request.text();
    const headers = {
      'svix-id': request.headers.get('svix-id')!,
      'svix-timestamp': request.headers.get('svix-timestamp')!,
      'svix-signature': request.headers.get('svix-signature')!,
    };

    const wh = new Webhook(RESEND_WEBHOOK_SIGNING_SECRET);
    let payload;
    try {
      payload = wh.verify(rawBody, headers);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ success: false, message: 'Signature verification failed' }, { status: 400 });
    }

    // At this point, the payload is verified and can be trusted.
    // The payload here is the parsed JSON object.
    console.log('Received verified Resend webhook payload:', JSON.stringify(payload, null, 2));

    // TODO: Process the payload (e.g., save email data to database based on payload.type)
    // Example: switch (payload.type) {
    //   case 'email.sent':
    //     // handle email sent event
    //     break;
    //   case 'email.delivered':
    //     // handle email delivered event
    //     break;
    //   // ... other event types
    // }

    return NextResponse.json({ success: true, message: 'Webhook received and verified' }, { status: 200 });
  } catch (error) {
    console.error('Error processing Resend webhook:', error);
    // Check if the error is from trying to parse an already parsed body or other issues
    if (error instanceof Error && error.message.includes("already been read")) {
        return NextResponse.json({ success: false, message: 'Error: Request body already read.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Error processing webhook' }, { status: 500 });
  }
} 