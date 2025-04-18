# PayPal Invoice API Integration Plan

## Overview
This plan outlines the steps to integrate PayPal's Invoice API with the Exo Drive's booking system to replace the current placeholder payment processing.

## Current System Analysis
- Two booking form components: `booking-form.tsx` and `car-detail/car-booking-form.tsx`
- Both have placeholder payment processing (lines 58 and 155 respectively)
- Forms collect necessary customer and booking data
- No actual payment integration exists yet
- Comments suggest Stripe was considered

## Implementation Plan

### 1. PayPal SDK Setup
- Install required dependencies:
  ```
  bun add @paypal/checkout-server-sdk
  ```
- Create PayPal environment configuration in `/lib/services/paypal-service.ts`

### 2. PayPal Invoice API Integration

#### A. Create Backend API Endpoints
- Create `/app/api/payments/create-invoice/route.ts` to generate invoices
- Create `/app/api/payments/invoice-status/route.ts` to check payment status
- Create `/app/api/payments/webhook/route.ts` for PayPal webhooks

#### B. Update Booking Forms
1. Modify `car-detail/car-booking-form.tsx`:
   - Update `handleBooking()` function to call invoice API endpoint
   - Create confirmation UI with invoice status and payment link
   - Add ability to check payment status

2. Update Database Schema
   - Add payment-related fields to booking table:
     - `invoice_id`
     - `payment_status`
     - `payment_method`

### 3. Implementation Details

#### Invoice Creation Flow
1. User completes booking form
2. System creates booking record with status "pending_payment"
3. System generates PayPal invoice with:
   - Customer information
   - Item details (car, dates, etc.)
   - Total amount
   - Due date
   - Memo with booking reference
4. System sends invoice to customer email
5. User pays via PayPal link
6. PayPal webhook updates booking status

#### Payment Status Tracking
- Create admin dashboard for payment status monitoring
- Implement automatic status checks for pending payments
- Add email notifications for payment status changes

## UI Updates
1. Add payment method selection section
2. Create success page with payment details and receipt
3. Add invoice preview before submission
4. Design payment status indicators

## Security Considerations
- Implement webhook signature verification
- Secure API route with proper authentication
- Validate all payment data
- Use environment variables for API keys

## Testing Plan
1. Test invoice creation with sandbox accounts
2. Verify webhook handling for payment notifications
3. Test cancellation and refund workflows
4. Perform end-to-end booking with payment tests

## Rollout Strategy
1. Develop in isolated branch
2. Test with PayPal sandbox
3. Conduct internal QA testing
4. Launch with optional fallback to manual booking