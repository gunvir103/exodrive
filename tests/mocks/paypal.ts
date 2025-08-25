import { mock } from "bun:test";

// Mock PayPal access token function
export const mockGetPayPalAccessToken = mock(async () => 'mock-access-token');

// Mock PayPal client
export const createMockPayPalClient = () => {
  return {
    orders: {
      create: mock(async () => ({
        result: {
          id: 'mock-order-id',
          status: 'CREATED',
          links: [
            {
              href: 'https://www.paypal.com/checkout/mock',
              rel: 'approve',
              method: 'GET',
            },
          ],
        },
      })),
      get: mock(async (orderId: string) => ({
        result: {
          id: orderId,
          status: 'APPROVED',
          purchase_units: [
            {
              amount: {
                currency_code: 'USD',
                value: '100.00',
              },
            },
          ],
        },
      })),
      capture: mock(async (orderId: string) => ({
        result: {
          id: orderId,
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'mock-capture-id',
                    status: 'COMPLETED',
                    amount: {
                      currency_code: 'USD',
                      value: '100.00',
                    },
                  },
                ],
              },
            },
          ],
        },
      })),
      authorize: mock(async (orderId: string) => ({
        result: {
          id: orderId,
          status: 'APPROVED',
          purchase_units: [
            {
              payments: {
                authorizations: [
                  {
                    id: 'mock-authorization-id',
                    status: 'CREATED',
                    amount: {
                      currency_code: 'USD',
                      value: '100.00',
                    },
                  },
                ],
              },
            },
          ],
        },
      })),
    },
    payments: {
      authorizationsGet: mock(async (authorizationId: string) => ({
        result: {
          id: authorizationId,
          status: 'CREATED',
          amount: {
            currency_code: 'USD',
            value: '100.00',
          },
        },
      })),
      authorizationsCapture: mock(async (authorizationId: string) => ({
        result: {
          id: 'mock-capture-id',
          status: 'COMPLETED',
          amount: {
            currency_code: 'USD',
            value: '100.00',
          },
        },
      })),
      authorizationsVoid: mock(async (authorizationId: string) => ({
        result: {
          id: authorizationId,
          status: 'VOIDED',
        },
      })),
      capturesGet: mock(async (captureId: string) => ({
        result: {
          id: captureId,
          status: 'COMPLETED',
          amount: {
            currency_code: 'USD',
            value: '100.00',
          },
        },
      })),
      capturesRefund: mock(async (captureId: string) => ({
        result: {
          id: 'mock-refund-id',
          status: 'COMPLETED',
          amount: {
            currency_code: 'USD',
            value: '100.00',
          },
        },
      })),
    },
  };
};

// Mock PayPal webhook verification
export const mockVerifyPayPalWebhook = mock(async (
  request: any,
  rawBody: string
): Promise<boolean> => {
  return true; // Default to valid webhook
});

// Helper to create PayPal webhook payload
export const createPayPalWebhookPayload = (
  eventType: string,
  resource: any = {},
  customId?: string
) => {
  return {
    id: `WH-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    event_type: eventType,
    resource_type: 'payment',
    summary: `${eventType} event`,
    resource: {
      id: resource.id || 'mock-resource-id',
      status: resource.status || 'COMPLETED',
      amount: resource.amount || {
        currency_code: 'USD',
        value: '100.00',
      },
      custom_id: customId,
      ...resource,
    },
    create_time: new Date().toISOString(),
    event_version: '1.0',
  };
};

// PayPal webhook event types
export const PAYPAL_WEBHOOK_EVENTS = {
  PAYMENT_AUTHORIZATION_CREATED: 'PAYMENT.AUTHORIZATION.CREATED',
  PAYMENT_AUTHORIZATION_VOIDED: 'PAYMENT.AUTHORIZATION.VOIDED',
  PAYMENT_CAPTURE_COMPLETED: 'PAYMENT.CAPTURE.COMPLETED',
  PAYMENT_CAPTURE_DENIED: 'PAYMENT.CAPTURE.DENIED',
  PAYMENT_CAPTURE_REFUNDED: 'PAYMENT.CAPTURE.REFUNDED',
  CUSTOMER_DISPUTE_CREATED: 'CUSTOMER.DISPUTE.CREATED',
  CUSTOMER_DISPUTE_RESOLVED: 'CUSTOMER.DISPUTE.RESOLVED',
  CUSTOMER_DISPUTE_UPDATED: 'CUSTOMER.DISPUTE.UPDATED',
  INVOICING_INVOICE_PAID: 'INVOICING.INVOICE.PAID',
  INVOICING_INVOICE_CANCELLED: 'INVOICING.INVOICE.CANCELLED',
  INVOICING_INVOICE_UPDATED: 'INVOICING.INVOICE.UPDATED',
};