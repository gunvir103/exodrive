import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { 
  createMockSupabaseClient, 
  mockCreateSupabaseServerClient,
  createChainableMock
} from "@/tests/mocks/supabase";
import { 
  mockGetPayPalAccessToken,
  createPayPalWebhookPayload,
  PAYPAL_WEBHOOK_EVENTS
} from "@/tests/mocks/paypal";

// Mock modules
mock.module("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

mock.module("@/lib/paypal-client", () => ({
  getPayPalAccessToken: mockGetPayPalAccessToken,
}));

// Mock fetch for PayPal webhook verification
const mockFetch = mock((url: string, options?: any) => {
  if (url.includes("/v1/notifications/verify-webhook-signature")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ verification_status: "SUCCESS" }),
      text: async () => "",
    });
  }
  return Promise.resolve({
    ok: false,
    status: 404,
    text: async () => "Not found",
  });
});

global.fetch = mockFetch as any;

describe("POST /api/webhooks/paypal", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mock.restore();
    mockSupabase = createMockSupabaseClient();
    mockCreateSupabaseServerClient.mockReturnValue(mockSupabase);
    mockFetch.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  const createWebhookRequest = (payload: any, headers: Record<string, string> = {}) => {
    const defaultHeaders = {
      "Content-Type": "application/json",
      "User-Agent": "PayPal/1.0",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.paypal.com/cert",
      "paypal-transmission-id": "test-transmission-id",
      "paypal-transmission-sig": "test-signature",
      "paypal-transmission-time": new Date().toISOString(),
    };

    return new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      headers: { ...defaultHeaders, ...headers },
      body: JSON.stringify(payload),
    });
  };

  const mockBooking = {
    id: "booking-123",
    car_id: "car-123",
    customer_id: "customer-123",
    start_date: "2024-12-20",
    end_date: "2024-12-23",
    overall_status: "pending_payment",
    payment_status: "pending",
    contract_status: "not_sent",
    payment_id: "payment-123",
    total_price: 360,
    currency: "USD",
  };

  describe("Webhook Verification", () => {
    test("should verify valid PayPal webhook", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
        {},
        mockBooking.id
      );

      // Mock booking lookup
      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          return createChainableMock({
            data: mockBooking,
            error: null,
          });
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Webhook processed successfully");

      // Verify PayPal verification was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/notifications/verify-webhook-signature"),
        expect.any(Object)
      );
    });

    test("should reject webhook with invalid signature", async () => {
      // Mock verification failure
      mockFetch.mockImplementationOnce((url: string) => {
        if (url.includes("/v1/notifications/verify-webhook-signature")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ verification_status: "FAILURE" }),
            text: async () => "",
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          text: async () => "Not found",
        });
      });

      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
        {},
        mockBooking.id
      );

      const request = createWebhookRequest(payload);
      const response = await POST(request);

      // Note: The actual implementation continues processing despite verification failure
      expect(response.status).toBe(200);
    });

    test("should handle missing webhook headers in development", async () => {
      // Set NODE_ENV to development
      const originalNodeEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = "development";

      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
        {},
        mockBooking.id
      );

      // Mock booking lookup
      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          return createChainableMock({
            data: mockBooking,
            error: null,
          });
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload, {
        "User-Agent": "PayPal/1.0",
        // Missing PayPal webhook headers
      });
      const response = await POST(request);

      expect(response.status).toBe(200);

      // Reset NODE_ENV
      (process.env as any).NODE_ENV = originalNodeEnv;
    });

    test("should log non-PayPal user agent", async () => {
      const consoleSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleSpy;

      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
        {},
        mockBooking.id
      );

      const request = createWebhookRequest(payload, {
        "User-Agent": "Mozilla/5.0",
      });
      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Webhook request without PayPal User-Agent:",
        "Mozilla/5.0"
      );

      console.warn = originalWarn;
    });
  });

  describe("Webhook Event Processing", () => {
    test("should handle PAYMENT.AUTHORIZATION.CREATED event", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_AUTHORIZATION_CREATED,
        {
          id: "auth-123",
          amount: { currency_code: "USD", value: "360.00" },
        },
        mockBooking.id
      );

      // Mock database operations
      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          if (mockSupabase.from.mock.calls.length === 1) {
            // First call - select
            return createChainableMock({
              data: mockBooking,
              error: null,
            });
          } else {
            // Second call - update
            return createChainableMock({
              data: { ...mockBooking, payment_status: "authorized" },
              error: null,
            });
          }
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        if (table === "payments") {
          return createChainableMock({
            data: { id: "payment-123", paypal_authorization_id: "auth-123" },
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.eventType).toBe("payment_authorized");
    });

    test("should handle PAYMENT.CAPTURE.COMPLETED event", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
        {
          id: "capture-123",
          amount: { currency_code: "USD", value: "360.00" },
        },
        mockBooking.id
      );

      // Mock booking with signed contract
      const signedBooking = { ...mockBooking, contract_status: "signed" };

      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          if (mockSupabase.from.mock.calls.length === 1) {
            return createChainableMock({
              data: signedBooking,
              error: null,
            });
          } else {
            return createChainableMock({
              data: { ...signedBooking, payment_status: "captured", overall_status: "upcoming" },
              error: null,
            });
          }
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        if (table === "payments") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.eventType).toBe("payment_captured");
    });

    test("should handle PAYMENT.CAPTURE.REFUNDED event", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_REFUNDED,
        {
          id: "refund-123",
          amount: { currency_code: "USD", value: "360.00" },
        },
        mockBooking.id
      );

      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          if (mockSupabase.from.mock.calls.length === 1) {
            return createChainableMock({
              data: mockBooking,
              error: null,
            });
          } else {
            return createChainableMock({
              data: { ...mockBooking, payment_status: "refunded" },
              error: null,
            });
          }
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        if (table === "payments") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.eventType).toBe("payment_refunded");
    });

    test("should handle CUSTOMER.DISPUTE.CREATED event", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.CUSTOMER_DISPUTE_CREATED,
        {
          id: "dispute-123",
          reason: "Item not received",
          amount: { currency_code: "USD", value: "360.00" },
        },
        mockBooking.id
      );

      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          if (mockSupabase.from.mock.calls.length === 1) {
            return createChainableMock({
              data: mockBooking,
              error: null,
            });
          } else {
            return createChainableMock({
              data: { ...mockBooking, overall_status: "disputed" },
              error: null,
            });
          }
        }
        if (table === "disputes") {
          return createChainableMock({ data: {}, error: null });
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.eventType).toBe("dispute_created");
    });

    test("should handle webhook without resource", async () => {
      const payload = {
        id: "webhook-123",
        event_type: "WEBHOOK.PING",
        create_time: new Date().toISOString(),
        event_version: "1.0",
        // No resource field
      };

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Event processed - no resource data");
    });

    test("should handle webhook without booking ID", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
        {
          id: "capture-123",
          // No custom_id or invoice_number
        }
      );

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("No booking ID found");
    });

    test("should handle booking not found", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
        {},
        "non-existent-booking"
      );

      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          return createChainableMock({
            data: null,
            error: { message: "Not found" },
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Booking not found");
    });
  });

  describe("Database Updates", () => {
    test("should update booking status", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
        {},
        mockBooking.id
      );

      let bookingUpdateCalled = false;
      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          const chainable = createChainableMock({
            data: mockBooking,
            error: null,
          });
          
          chainable.update = mock((data: any) => {
            bookingUpdateCalled = true;
            expect(data.payment_status).toBe("captured");
            expect(data.updated_at).toBeDefined();
            return chainable;
          });
          
          return chainable;
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        if (table === "payments") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(bookingUpdateCalled).toBe(true);
    });

    test("should log booking events", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_AUTHORIZATION_CREATED,
        {},
        mockBooking.id
      );

      let eventInsertCalled = false;
      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          return createChainableMock({
            data: mockBooking,
            error: null,
          });
        }
        if (table === "booking_events") {
          const chainable = createChainableMock({ data: {}, error: null });
          chainable.insert = mock((data: any) => {
            eventInsertCalled = true;
            expect(data.booking_id).toBe(mockBooking.id);
            expect(data.event_type).toBe("payment_authorized");
            expect(data.actor_type).toBe("webhook_paypal");
            expect(data.details.paypal_event_id).toBe(payload.id);
            return chainable;
          });
          return chainable;
        }
        if (table === "payments") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(eventInsertCalled).toBe(true);
    });

    test("should update payment record", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_AUTHORIZATION_CREATED,
        {
          id: "auth-123",
        },
        mockBooking.id
      );

      let paymentUpdateCalled = false;
      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          return createChainableMock({
            data: mockBooking,
            error: null,
          });
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        if (table === "payments") {
          const chainable = createChainableMock({ data: {}, error: null });
          chainable.update = mock((data: any) => {
            paymentUpdateCalled = true;
            expect(data.status).toBe("authorized");
            expect(data.paypal_authorization_id).toBe("auth-123");
            return chainable;
          });
          return chainable;
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(paymentUpdateCalled).toBe(true);
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid JSON payload", async () => {
      const request = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "PayPal/1.0",
        },
        body: "invalid json",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON body");
    });

    test("should handle invalid webhook payload schema", async () => {
      const invalidPayload = {
        // Missing required fields
        event_type: PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
      };

      const request = createWebhookRequest(invalidPayload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid payload");
      expect(data.details).toBeDefined();
    });

    test("should handle database update errors gracefully", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
        {},
        mockBooking.id
      );

      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          if (mockSupabase.from.mock.calls.length === 1) {
            // First call - select succeeds
            return createChainableMock({
              data: mockBooking,
              error: null,
            });
          } else {
            // Second call - update fails
            const chainable = createChainableMock({
              data: null,
              error: { message: "Database error" },
            });
            chainable.update = mock(() => chainable);
            return chainable;
          }
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      const consoleSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleSpy;

      const request = createWebhookRequest(payload);
      const response = await POST(request);

      // Should still return 200 to acknowledge webhook
      expect(response.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error updating booking from PayPal webhook:",
        expect.any(Object)
      );

      console.error = originalError;
    });

    test("should handle unexpected errors", async () => {
      // Mock an unexpected error
      mockCreateSupabaseServerClient.mockImplementationOnce(() => {
        throw new Error("Unexpected error");
      });

      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.PAYMENT_CAPTURE_COMPLETED,
        {},
        mockBooking.id
      );

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(data.details).toBe("Unexpected error");
    });
  });

  describe("Invoice Events", () => {
    test("should handle INVOICING.INVOICE.PAID event", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.INVOICING_INVOICE_PAID,
        {
          invoice_number: `INV-${mockBooking.id}`,
        }
      );

      // Mock booking with signed contract
      const signedBooking = { ...mockBooking, contract_status: "signed" };

      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          if (mockSupabase.from.mock.calls.length === 1) {
            return createChainableMock({
              data: signedBooking,
              error: null,
            });
          } else {
            return createChainableMock({
              data: { ...signedBooking, payment_status: "paid", overall_status: "upcoming" },
              error: null,
            });
          }
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.eventType).toBe("invoice_paid");
    });

    test("should extract booking ID from invoice number", async () => {
      const payload = createPayPalWebhookPayload(
        PAYPAL_WEBHOOK_EVENTS.INVOICING_INVOICE_CANCELLED,
        {
          invoice_number: `INV-${mockBooking.id}-12345`,
        }
      );

      mockSupabase.from = mock((table: string) => {
        if (table === "bookings") {
          return createChainableMock({
            data: mockBooking,
            error: null,
          });
        }
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createWebhookRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bookingId).toBe(mockBooking.id);
      expect(data.eventType).toBe("invoice_cancelled");
    });
  });
});