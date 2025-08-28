import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { 
  createMockSupabaseClient, 
  mockCreateSupabaseServerClient,
  createChainableMock
} from "@/tests/mocks/supabase";
import { createMockRedisClient, mockInvalidateCacheByEvent } from "@/tests/mocks/redis";
import { mockSendBookingConfirmationEmail } from "@/tests/mocks/email";

// Mock modules
mock.module("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

mock.module("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => createMockRedisClient(),
  },
}));

mock.module("@/lib/redis", () => ({
  invalidateCacheByEvent: mockInvalidateCacheByEvent,
}));

mock.module("@/lib/email/booking-emails", () => ({
  sendBookingConfirmationEmail: mockSendBookingConfirmationEmail,
}));

describe("POST /api/bookings", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let mockRedis: ReturnType<typeof createMockRedisClient>;

  beforeEach(() => {
    mock.restore();
    mockSupabase = createMockSupabaseClient();
    mockRedis = createMockRedisClient();
    mockCreateSupabaseServerClient.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    mock.restore();
  });

  const createRequest = (body: any) => {
    return new NextRequest("http://localhost:3000/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  };

  const validBookingData = {
    carId: "550e8400-e29b-41d4-a716-446655440001",
    startDate: "2024-12-20",
    endDate: "2024-12-23",
    customerDetails: {
      fullName: "John Doe",
      email: "john.doe@example.com",
      phone: "+1234567890",
    },
    totalPrice: 360,
    currency: "USD",
    securityDepositAmount: 500,
  };

  describe("Validation", () => {
    test("should reject invalid request payload", async () => {
      const request = createRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request payload");
      expect(data.details).toBeDefined();
    });

    test("should reject missing required fields", async () => {
      const invalidData = { ...validBookingData };
      // Store original value and delete property
      const originalCarId = invalidData.carId;
      delete (invalidData as any).carId;

      const request = createRequest(invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request payload");
      
      // Restore for cleanup (though not strictly needed in tests)
      (invalidData as any).carId = originalCarId;
    });

    test("should reject invalid email format", async () => {
      const invalidData = {
        ...validBookingData,
        customerDetails: {
          ...validBookingData.customerDetails,
          email: "invalid-email",
        },
      };

      const request = createRequest(invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request payload");
    });

    test("should reject invalid date format", async () => {
      const invalidData = {
        ...validBookingData,
        startDate: "2024/12/20", // Wrong format
      };

      const request = createRequest(invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request payload");
    });

    test("should reject start date after end date", async () => {
      const invalidData = {
        ...validBookingData,
        startDate: "2024-12-25",
        endDate: "2024-12-20",
      };

      const request = createRequest(invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Start date must be before end date");
    });

    test("should reject negative total price", async () => {
      const invalidData = {
        ...validBookingData,
        totalPrice: -100,
      };

      const request = createRequest(invalidData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request payload");
    });
  });

  describe("Booking Lock", () => {
    test("should acquire lock successfully", async () => {
      // Mock Edge Function response
      mockSupabase.functions.invoke = mock(async (functionName: string, options?: any) => ({
        data: {
          success: true,
          bookingId: "booking-123",
          customerId: "customer-123",
        },
        error: null,
      })) as any;

      // Mock car details
      mockSupabase.from = mock((table: string) => {
        if (table === "cars") {
          return createChainableMock({
            data: { name: "Tesla Model 3" },
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validBookingData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.bookingId).toBe("booking-123");

      // Check if lock was acquired and released
      const lockKey = `booking_lock:car:${validBookingData.carId}:range:${validBookingData.startDate}_${validBookingData.endDate}`;
      expect(mockRedis.set).toHaveBeenCalledWith(lockKey, "locked", { nx: true, ex: 30 });
      expect(mockRedis.del).toHaveBeenCalledWith(lockKey);
    });

    test("should fail if lock cannot be acquired", async () => {
      // Mock lock already exists
      mockRedis.set.mockResolvedValueOnce(null); // Lock acquisition fails

      const request = createRequest(validBookingData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain("Failed to acquire booking lock");
    });
  });

  describe("Edge Function Integration", () => {
    test("should handle successful booking creation", async () => {
      // Mock successful Edge Function response
      mockSupabase.functions.invoke = mock(async (functionName: string, options?: any) => ({
        data: {
          success: true,
          bookingId: "booking-123",
          customerId: "customer-123",
        },
        error: null,
      })) as any;

      // Mock car details for email
      mockSupabase.from = mock((table: string) => {
        if (table === "cars") {
          return createChainableMock({
            data: { name: "Tesla Model 3" },
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validBookingData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("Booking process initiated successfully!");
      expect(data.bookingId).toBe("booking-123");
      expect(data.customerId).toBe("customer-123");
      expect(data.bookingUrl).toContain("/booking/");
      expect(data.status).toBe("pending_payment");

      // Verify Edge Function was called with correct payload
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        "create-booking-transaction",
        expect.objectContaining({
          body: expect.objectContaining({
            carId: validBookingData.carId,
            startDate: validBookingData.startDate,
            endDate: validBookingData.endDate,
            totalPrice: validBookingData.totalPrice,
            currency: validBookingData.currency,
            securityDepositAmount: validBookingData.securityDepositAmount,
          }),
        })
      );
    });

    test("should handle Edge Function errors", async () => {
      // Mock Edge Function error
      mockSupabase.functions.invoke = mock(async (functionName: string, options?: any) => ({
        data: null,
        error: {
          message: "Edge function failed",
          context: {
            details: JSON.stringify({
              error: "dates_unavailable",
              unavailableDates: ["2024-12-21", "2024-12-22"],
            }),
          },
        },
      })) as any;

      const request = createRequest(validBookingData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Booking creation failed via Edge Function.");
      expect(data.details).toContain("dates_unavailable");
    });

    test("should handle dates unavailable error", async () => {
      // Mock Edge Function response with dates unavailable
      mockSupabase.functions.invoke = mock(async (functionName: string, options?: any) => ({
        data: {
          success: false,
          error: "dates_unavailable",
        },
        error: null,
      })) as any;

      const request = createRequest(validBookingData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Booking creation failed.");
      expect(data.details).toBe("dates_unavailable");
    });
  });

  describe("Email Notifications", () => {
    test("should send confirmation email on successful booking", async () => {
      // Mock successful booking
      mockSupabase.functions.invoke = mock(async (functionName: string, options?: any) => ({
        data: {
          success: true,
          bookingId: "booking-123",
          customerId: "customer-123",
        },
        error: null,
      })) as any;

      // Mock car details
      mockSupabase.from = mock((table: string) => {
        if (table === "cars") {
          return createChainableMock({
            data: { name: "Tesla Model 3" },
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validBookingData);
      const response = await POST(request);

      expect(response.status).toBe(201);

      // Verify email was sent
      expect(mockSendBookingConfirmationEmail).toHaveBeenCalledWith({
        customerEmail: validBookingData.customerDetails.email,
        customerName: validBookingData.customerDetails.fullName,
        bookingId: "booking-123",
        carName: "Tesla Model 3",
        startDate: validBookingData.startDate,
        endDate: validBookingData.endDate,
        totalPrice: validBookingData.totalPrice,
        currency: validBookingData.currency,
        bookingUrl: expect.stringContaining("/booking/"),
      });
    });

    test("should not fail booking if email fails", async () => {
      // Mock successful booking
      mockSupabase.functions.invoke = mock(async (functionName: string, options?: any) => ({
        data: {
          success: true,
          bookingId: "booking-123",
          customerId: "customer-123",
        },
        error: null,
      })) as any;

      // Mock car details
      mockSupabase.from = mock((table: string) => {
        if (table === "cars") {
          return createChainableMock({
            data: { name: "Tesla Model 3" },
            error: null,
          });
        }
        // Mock booking_events insert for error logging
        if (table === "booking_events") {
          return createChainableMock({ data: {}, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      // Mock email failure
      mockSendBookingConfirmationEmail.mockRejectedValueOnce(
        new Error("Email service unavailable")
      );

      const request = createRequest(validBookingData);
      const response = await POST(request);
      const data = await response.json();

      // Booking should still succeed
      expect(response.status).toBe(201);
      expect(data.bookingId).toBe("booking-123");
    });
  });

  describe("Cache Invalidation", () => {
    test("should invalidate cache after successful booking", async () => {
      // Mock successful booking
      mockSupabase.functions.invoke = mock(async (functionName: string, options?: any) => ({
        data: {
          success: true,
          bookingId: "booking-123",
          customerId: "customer-123",
        },
        error: null,
      })) as any;

      // Mock car details
      mockSupabase.from = mock((table: string) => {
        if (table === "cars") {
          return createChainableMock({
            data: { name: "Tesla Model 3" },
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validBookingData);
      const response = await POST(request);

      expect(response.status).toBe(201);

      // Verify cache invalidation
      expect(mockInvalidateCacheByEvent).toHaveBeenCalledWith("booking.created");
    });
  });

  describe("Customer Name Parsing", () => {
    test("should parse full name into first and last name", async () => {
      // Mock Edge Function to capture the payload
      let capturedPayload: any;
      mockSupabase.functions.invoke = mock(async (name: string, options: any) => {
        capturedPayload = options.body;
        return {
          data: {
            success: true,
            bookingId: "booking-123",
            customerId: "customer-123",
          },
          error: null,
        };
      }) as any;

      // Mock car details
      mockSupabase.from = mock(() =>
        createChainableMock({ data: { name: "Tesla Model 3" }, error: null })
      );

      const request = createRequest({
        ...validBookingData,
        customerDetails: {
          ...validBookingData.customerDetails,
          fullName: "John Michael Doe Smith",
        },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(capturedPayload.customerDetails.firstName).toBe("John");
      expect(capturedPayload.customerDetails.lastName).toBe("Michael Doe Smith");
    });

    test("should handle single name", async () => {
      // Mock Edge Function to capture the payload
      let capturedPayload: any;
      mockSupabase.functions.invoke = mock(async (name: string, options: any) => {
        capturedPayload = options.body;
        return {
          data: {
            success: true,
            bookingId: "booking-123",
            customerId: "customer-123",
          },
          error: null,
        };
      }) as any;

      // Mock car details
      mockSupabase.from = mock(() =>
        createChainableMock({ data: { name: "Tesla Model 3" }, error: null })
      );

      const request = createRequest({
        ...validBookingData,
        customerDetails: {
          ...validBookingData.customerDetails,
          fullName: "Madonna",
        },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(capturedPayload.customerDetails.firstName).toBe("Madonna");
      expect(capturedPayload.customerDetails.lastName).toBe("");
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid JSON in request body", async () => {
      const request = new NextRequest("http://localhost:3000/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to process booking request.");
    });

    test("should handle unexpected errors", async () => {
      // Mock an unexpected error
      mockCreateSupabaseServerClient.mockImplementationOnce(() => {
        throw new Error("Unexpected database error");
      });

      const request = createRequest(validBookingData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to process booking request.");
      expect(data.details).toBe("Unexpected database error");
    });

    test("should always release lock on error", async () => {
      // Mock Edge Function error
      mockSupabase.functions.invoke = mock(async (functionName: string, options?: any) => {
        throw new Error("Edge function crashed");
      }) as any;

      const request = createRequest(validBookingData);
      const response = await POST(request);

      expect(response.status).toBe(500);

      // Verify lock was still released
      const lockKey = `booking_lock:car:${validBookingData.carId}:range:${validBookingData.startDate}_${validBookingData.endDate}`;
      expect(mockRedis.del).toHaveBeenCalledWith(lockKey);
    });
  });
});