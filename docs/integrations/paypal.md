# ExoDrive PayPal Integration Documentation

## Overview

ExoDrive uses PayPal as the primary payment processor for car rental bookings. This document outlines the complete PayPal integration architecture, implementation details, and maintenance procedures.

## Architecture Overview

```
Frontend (React) → PayPal JS SDK → API Routes → PayPal Server SDK → Database
       ↓              ↓               ↓               ↓             ↓
   Booking Form → PayPal Buttons → Order Creation → Payment Capture → Booking Record
                        ↓               ↓               ↓             ↓
                   User Payment → PayPal Webhook → Status Update → Email Notification
```

## PayPal Dependencies

### Frontend Dependencies
```json
{
  "@paypal/paypal-js": "8.2.0",
  "@paypal/react-paypal-js": "8.8.3"
}
```

### Backend Dependencies
```json
{
  "@paypal/paypal-server-sdk": "^1.0.2"
}
```

## Environment Configuration

### Required Environment Variables
```env
# PayPal Configuration
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENVIRONMENT=sandbox  # or live for production

# PayPal Webhook Configuration
PAYPAL_WEBHOOK_ID=your_webhook_id
PAYPAL_WEBHOOK_SECRET=your_webhook_secret

# PayPal API URLs
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com  # sandbox
# PAYPAL_BASE_URL=https://api-m.paypal.com  # production
```

## Database Schema

### PayPal-Related Tables

#### 1. `payments` Table
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  amount NUMERIC NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status payment_status_enum DEFAULT 'pending',
  
  -- PayPal-specific fields
  paypal_order_id VARCHAR(255),
  paypal_authorization_id VARCHAR(255),
  paypal_invoice_id VARCHAR(255),
  
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. `paypal_invoices` Table
```sql
CREATE TABLE paypal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  paypal_invoice_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Invoice details
  amount_due NUMERIC NOT NULL,
  amount_paid NUMERIC,
  currency_code VARCHAR(3) DEFAULT 'USD',
  
  -- Invoice status and dates
  status paypal_invoice_status_enum DEFAULT 'DRAFT',
  due_date TIMESTAMPTZ,
  created_on_paypal_at TIMESTAMPTZ,
  last_paypal_update_at TIMESTAMPTZ,
  
  -- Invoice content
  line_items JSONB,
  notes_to_recipient TEXT,
  terms_and_conditions TEXT,
  invoice_url VARCHAR(500),
  
  -- Fees and discounts
  tax_amount NUMERIC,
  tax_name VARCHAR(100),
  discount_amount NUMERIC,
  discount_percentage NUMERIC,
  
  -- Audit fields
  created_by_actor_type actor_type_enum,
  created_by_actor_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. PayPal-Related Enums
```sql
CREATE TYPE payment_status_enum AS ENUM (
  'pending',
  'authorized', 
  'captured',
  'refunded',
  'voided',
  'failed'
);

CREATE TYPE paypal_invoice_status_enum AS ENUM (
  'DRAFT',
  'SENT', 
  'SCHEDULED',
  'PAYMENT_PENDING',
  'PAID',
  'MARKED_AS_PAID',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'MARKED_AS_REFUNDED',
  'VOIDED'
);
```

## Database Functions

### `create_booking_with_paypal_payment`

This PostgreSQL function atomically creates a booking with PayPal payment capture:

```sql
CREATE OR REPLACE FUNCTION create_booking_with_paypal_payment(
    p_car_id UUID,
    p_start_date DATE,
    p_end_date DATE, 
    p_total_price NUMERIC,
    p_customer_first_name TEXT,
    p_customer_last_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT,
    p_paypal_order_id TEXT,
    p_amount_paid NUMERIC
) RETURNS JSONB
```

**Function Features:**
- ✅ Atomic transaction handling
- ✅ Car availability validation
- ✅ Customer upsert (find or create)
- ✅ Booking record creation
- ✅ Payment record creation with PayPal order ID
- ✅ Car availability updates
- ✅ Booking event logging
- ✅ Comprehensive error handling

## Frontend Implementation

### PayPal Provider Setup

```typescript
// app/providers.tsx
import { PayPalScriptProvider } from "@paypal/react-paypal-js"

const initialOptions = {
  "clientId": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "sb",
  "currency": "USD", 
  "intent": "capture",
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PayPalScriptProvider options={initialOptions}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </PayPalScriptProvider>
  )
}
```

### Booking Form Integration

The booking form (`components/car-detail/car-booking-form.tsx`) implements a two-step process:

1. **Date Selection & Pricing**
2. **Customer Information & PayPal Payment**

Key features:
- ✅ Real-time price calculation
- ✅ Form validation before payment
- ✅ PayPal buttons integration
- ✅ Loading states and error handling
- ✅ Success state management

```typescript
// PayPal order creation
const createPayPalOrder = async (): Promise<string> => {
  const response = await fetch('/api/bookings/create-paypal-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: totalPrice }),
  });
  const order = await response.json();
  return order.orderID;
};

// PayPal payment approval
const onPayPalApprove = async (data: any): Promise<void> => {
  const bookingDetails = {
    carId,
    startDate: format(startDate!, "yyyy-MM-dd"),
    endDate: format(endDate!, "yyyy-MM-dd"), 
    totalPrice,
    customer: {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
    },
  };

  const response = await fetch('/api/bookings/capture-paypal-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderID: data.orderID, bookingDetails }),
  });
  
  // Handle success/error states
};
```

## Custom Button Styling

The application overrides default PayPal SDK styling to maintain consistency with the site's black/minimalist design theme.

### Override Approach
The application uses CSS `!important` declarations to override PayPal SDK default styling:

- **Color Scheme**: Black theme (#0a0a0a) matching site design
- **Shape**: Pill shape (border-radius: 9999px) for consistency
- **Height**: Consistent 45px height for accessibility
- **Hover Effects**: translateY(-2px) with shadow effects
- **Dark Mode**: Conditional styling with rgba colors for dark theme support

### Implementation Details

#### CSS Overrides
Location: `app/globals.css` lines 430-504

The CSS targets PayPal buttons using attribute selectors:
- `[data-funding-source="paypal"]` - PayPal payment button
- `[data-funding-source="card"]` - Debit/Credit card button

#### Component Configuration
Location: `components/car-detail/car-booking-form.tsx`

PayPal button configuration:
- Layout: vertical
- Color: black (to match site theme)
- Shape: pill (fully rounded)
- Height: 45px
- Label: "pay"

### Styling Classes

Key CSS classes for PayPal button customization:
- `.paypal-buttons-wrapper` - Container wrapper for spacing
- `.paypal-buttons` - Main button container
- `.debit-card-button`, `.credit-card-button` - Alternative payment buttons

### Browser Compatibility
The styling overrides are tested across major browsers and maintain consistency in:
- Chrome/Edge (Chromium-based)
- Firefox
- Safari
- Mobile browsers

## Backend API Implementation

### API Routes Structure

```
app/api/
├── bookings/
│   ├── create-paypal-order/
│   │   └── route.ts           # Creates PayPal order
│   ├── capture-paypal-order/
│   │   └── route.ts           # Captures payment & creates booking
│   └── route.ts               # General booking operations
└── webhooks/
    └── paypal/
        └── route.ts           # PayPal webhook handler
```

### 1. PayPal Order Creation API

**Endpoint:** `POST /api/bookings/create-paypal-order`

```typescript
// Implementation needed in: app/api/bookings/create-paypal-order/route.ts
import { PayPalApi } from '@paypal/paypal-server-sdk';

export async function POST(request: Request) {
  try {
    const { amount } = await request.json();
    
    const orderRequest = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: amount.toString()
        }
      }]
    };
    
    const { result } = await paypalClient.orders.ordersCreate({
      body: orderRequest
    });
    
    return Response.json({ orderID: result.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### 2. PayPal Order Capture API

**Endpoint:** `POST /api/bookings/capture-paypal-order`

```typescript
// Implementation needed in: app/api/bookings/capture-paypal-order/route.ts
export async function POST(request: Request) {
  try {
    const { orderID, bookingDetails } = await request.json();
    
    // 1. Capture PayPal payment
    const { result } = await paypalClient.orders.ordersCapture({
      id: orderID,
      body: {}
    });
    
    if (result.status !== 'COMPLETED') {
      throw new Error('Payment capture failed');
    }
    
    // 2. Create booking using database function
    const { data, error } = await supabase.rpc('create_booking_with_paypal_payment', {
      p_car_id: bookingDetails.carId,
      p_start_date: bookingDetails.startDate,
      p_end_date: bookingDetails.endDate,
      p_total_price: bookingDetails.totalPrice,
      p_customer_first_name: bookingDetails.customer.firstName,
      p_customer_last_name: bookingDetails.customer.lastName,
      p_customer_email: bookingDetails.customer.email,
      p_customer_phone: bookingDetails.customer.phone,
      p_paypal_order_id: orderID,
      p_amount_paid: parseFloat(result.purchase_units[0].payments.captures[0].amount.value)
    });
    
    if (error || !data.success) {
      // Handle refund if booking creation fails
      await refundPayPalOrder(orderID);
      throw new Error(data.error || 'Booking creation failed');
    }
    
    return Response.json({ success: true, bookingId: data.bookingId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### 3. PayPal Webhook Handler

**Endpoint:** `POST /api/webhooks/paypal`

```typescript
// Implementation needed in: app/api/webhooks/paypal/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('paypal-transmission-sig');
    
    // Verify webhook signature
    const isValid = await verifyPayPalWebhook(body, signature);
    if (!isValid) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const event = JSON.parse(body);
    
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCaptureCompleted(event);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await handlePaymentCaptureDenied(event);
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handlePaymentRefunded(event);
        break;
      default:
        console.log(`Unhandled PayPal event: ${event.event_type}`);
    }
    
    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

## PayPal Client Configuration

### PayPal SDK Setup

```typescript
// lib/paypal-client.ts
import { 
  PayPalApi,
  OrdersController,
  PaymentsController,
  InvoicesController,
  DisputesController
} from '@paypal/paypal-server-sdk';

const environment = process.env.PAYPAL_ENVIRONMENT === 'live' 
  ? Environment.Production 
  : Environment.Sandbox;

const paypalClient = new PayPalApi({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
  },
  environment,
  logging: {
    logLevel: LogLevel.INFO,
    logRequest: true,
    logResponse: true,
  },
});

export const paypalOrders = paypalClient.ordersController;
export const paypalPayments = paypalClient.paymentsController;
export const paypalInvoices = paypalClient.invoicesController;
export const paypalDisputes = paypalClient.disputesController;

export default paypalClient;
```

### PayPal Helper Functions

```typescript
// lib/paypal-helpers.ts

export async function createPayPalOrder(amount: number, currency = 'USD') {
  const orderRequest = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: currency,
        value: amount.toString()
      }
    }],
    application_context: {
      brand_name: 'ExoDrive',
      user_action: 'PAY_NOW',
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/booking/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/booking/cancelled`
    }
  };
  
  const { result } = await paypalOrders.ordersCreate({
    body: orderRequest
  });
  
  return result;
}

export async function capturePayPalOrder(orderID: string) {
  const { result } = await paypalOrders.ordersCapture({
    id: orderID,
    body: {}
  });
  
  return result;
}

export async function refundPayPalOrder(orderID: string, amount?: number) {
  // Get capture ID from order
  const order = await paypalOrders.ordersGet({ id: orderID });
  const captureID = order.result.purchase_units[0].payments.captures[0].id;
  
  const refundRequest = amount ? {
    amount: {
      currency_code: 'USD',
      value: amount.toString()
    }
  } : {};
  
  const { result } = await paypalPayments.capturesRefund({
    id: captureID,
    body: refundRequest
  });
  
  return result;
}

export async function verifyPayPalWebhook(
  body: string, 
  signature: string
): Promise<boolean> {
  try {
    const { result } = await paypalClient.webhookVerification.verifyWebhookSignature({
      body: {
        auth_algo: signature.split('=')[0],
        transmission_id: signature.split('=')[1],
        cert_id: process.env.PAYPAL_WEBHOOK_CERT_ID!,
        payload: body,
        transmission_sig: signature,
        webhook_id: process.env.PAYPAL_WEBHOOK_ID!,
        webhook_event: JSON.parse(body)
      }
    });
    
    return result.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('PayPal webhook verification failed:', error);
    return false;
  }
}
```

## Error Handling & Recovery

### Payment Failure Recovery

1. **Order Creation Failure:**
   - Log error details
   - Show user-friendly error message
   - Allow retry with alternative payment method

2. **Capture Failure:**
   - Void the PayPal order
   - Release car availability hold
   - Notify customer of failure

3. **Booking Creation Failure:**
   - Automatically refund PayPal payment
   - Log failure details for investigation
   - Send failure notification to admin

### Error Handling Pattern

```typescript
export async function handlePaymentError(
  error: any,
  orderID?: string,
  bookingData?: any
) {
  // Log error details
  console.error('Payment error:', {
    error: error.message,
    orderID,
    bookingData,
    timestamp: new Date().toISOString()
  });
  
  // Cleanup if necessary
  if (orderID) {
    try {
      await refundPayPalOrder(orderID);
    } catch (refundError) {
      console.error('Refund failed:', refundError);
      // Alert admin of manual refund needed
    }
  }
  
  // Release car availability if booking data exists
  if (bookingData?.carId) {
    await releasePendingAvailability(
      bookingData.carId,
      bookingData.startDate,
      bookingData.endDate
    );
  }
  
  return {
    success: false,
    error: 'Payment processing failed. Any charges will be refunded within 24 hours.'
  };
}
```

## Security Considerations

### 1. Environment Variables Security
- Store sensitive PayPal credentials in environment variables
- Use different credentials for sandbox vs production
- Never expose client secret in frontend code

### 2. Webhook Security
- Verify all PayPal webhook signatures
- Use HTTPS endpoints only
- Implement rate limiting on webhook endpoints

### 3. Payment Validation
- Always verify payment amounts server-side
- Validate order details before capture
- Implement idempotency for payment operations

### 4. PCI Compliance
- PayPal handles all card data (PCI DSS compliant)
- Never store or log sensitive payment information
- Use PayPal's secure payment flow

## Testing

### Sandbox Testing

1. **Setup Sandbox Accounts:**
   - Business account for receiving payments
   - Personal accounts for testing payments

2. **Test Payment Flows:**
   - Successful payment capture
   - Payment failures
   - Partial refunds
   - Full refunds
   - Webhook delivery

3. **Test Card Numbers:**
```
Visa: 4111111111111111
Mastercard: 5555555555554444
Amex: 378282246310005
Declined: 4000000000000002
```

### Production Testing

1. **Pre-launch Checklist:**
   - [ ] Production PayPal app configured
   - [ ] Webhook endpoints verified
   - [ ] SSL certificates valid
   - [ ] Error handling tested
   - [ ] Refund process tested

2. **Monitoring Setup:**
   - Payment success/failure rates
   - Webhook delivery success
   - Average payment processing time
   - Error log monitoring

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Payment Metrics:**
   - Payment success rate (target: >99%)
   - Average payment processing time
   - Refund rate
   - Dispute rate

2. **Technical Metrics:**
   - API response times
   - Webhook delivery success rate
   - Database transaction success rate
   - Error rates by endpoint

3. **Business Metrics:**
   - Revenue per day/week/month
   - Average booking value
   - Payment method preferences
   - Conversion rates

### Alert Configurations

```typescript
// Example alert thresholds
const ALERT_THRESHOLDS = {
  paymentFailureRate: 0.05,     // 5% failure rate
  webhookFailureRate: 0.02,     // 2% webhook failure rate
  avgResponseTime: 5000,        // 5 seconds
  errorRate: 0.01               // 1% error rate
};
```

## Deployment Checklist

### Environment Setup
- [ ] PayPal app configured (sandbox/production)
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Webhook endpoints configured
- [ ] SSL certificates installed

### Testing
- [ ] End-to-end payment flow tested
- [ ] Webhook delivery verified
- [ ] Error scenarios tested
- [ ] Refund process validated
- [ ] Load testing completed

### Monitoring
- [ ] Payment monitoring configured
- [ ] Error alerting set up
- [ ] Performance dashboards created
- [ ] Log aggregation configured

## Troubleshooting

### Common Issues

1. **"PayPal order creation failed"**
   - Check PayPal credentials
   - Verify amount format (string, no currency symbols)
   - Check PayPal API status

2. **"Webhook signature verification failed"**
   - Verify webhook ID and secret
   - Check SSL certificate validity
   - Ensure webhook URL is accessible

3. **"Booking creation failed after payment"**
   - Check database connectivity
   - Verify car availability data
   - Check function parameters

4. **"PayPal buttons not loading"**
   - Verify client ID is set
   - Check for console errors
   - Ensure PayPal script loaded

### Debug Tools

```typescript
// Enable PayPal debug mode
const paypalOptions = {
  "client-id": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  "currency": "USD",
  "intent": "capture",
  "debug": process.env.NODE_ENV === 'development'
};
```

## Maintenance Tasks

### Daily
- Monitor payment success rates
- Check for failed webhooks
- Review error logs

### Weekly  
- Analyze payment trends
- Review dispute cases
- Update test scenarios

### Monthly
- Review PayPal fees and rates
- Audit refund requests
- Update documentation
- Security review

## Future Enhancements

### Planned Features

1. **Multi-Currency Support**
   - Dynamic currency selection
   - Real-time exchange rates
   - Localized payment experiences

2. **Advanced Invoicing**
   - Automated invoice generation
   - Custom invoice templates
   - Invoice scheduling

3. **Subscription Support**
   - Recurring payment plans
   - Subscription management
   - Automatic billing

4. **Enhanced Analytics**
   - Payment funnel analysis
   - Customer payment preferences
   - Revenue forecasting

### Technical Improvements

1. **Performance Optimization**
   - Payment flow caching
   - Webhook processing optimization
   - Database query optimization

2. **Error Recovery**
   - Automatic retry mechanisms
   - Intelligent error handling
   - Self-healing systems

3. **Security Enhancements**
   - Advanced fraud detection
   - Multi-factor authentication
   - Enhanced monitoring

---

## Support & Documentation

- **PayPal Developer Documentation:** https://developer.paypal.com/
- **PayPal SDK Documentation:** https://github.com/paypal/paypal-server-sdk-nodejs
- **Support:** Contact DevOps team for production issues
- **Last Updated:** January 21, 2025