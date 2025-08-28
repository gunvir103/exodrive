import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { 
  makeAuthenticatedRequest, 
  TEST_FIXTURES, 
  wait,
  generateTestId,
  testSupabase
} from "./test-helpers";

describe("Complete Booking Flow Integration", () => {
  const testCarId = TEST_FIXTURES.cars[0].id;
  const testCustomer = {
    fullName: "Integration Test User",
    email: `test-${Date.now()}@example.com`,
    phone: "+1234567890",
  };

  let createdBookingId: string | null = null;
  let createdCustomerId: string | null = null;
  let bookingToken: string | null = null;

  afterAll(async () => {
    // Clean up test data
    if (createdBookingId) {
      await testSupabase
        .from("booking_events")
        .delete()
        .eq("booking_id", createdBookingId);

      await testSupabase
        .from("payments")
        .delete()
        .eq("booking_id", createdBookingId);

      await testSupabase
        .from("secure_booking_tokens")
        .delete()
        .eq("booking_id", createdBookingId);

      await testSupabase
        .from("bookings")
        .delete()
        .eq("id", createdBookingId);
    }

    if (createdCustomerId) {
      await testSupabase
        .from("customers")
        .delete()
        .eq("id", createdCustomerId);
    }
  });

  describe("Step 1: Check Car Availability", () => {
    test("should get car availability for date range", async () => {
      const startDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const endDate = new Date(Date.now() + 33 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { response, data } = await makeAuthenticatedRequest(
        `/api/cars/availability?carId=${testCarId}&startDate=${startDate}&endDate=${endDate}`
      );

      expect(response.status).toBe(200);
      expect(data.carId).toBe(testCarId);
      expect(data.availability).toBeArray();
      expect(data.availability.length).toBe(4); // 4 days
      expect(data.summary.totalDays).toBe(4);
    });

    test("should handle unavailable dates", async () => {
      // First, create a booking to make dates unavailable
      const blockedStartDate = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const blockedEndDate = new Date(Date.now() + 37 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Create a blocking booking
      const { data: blockingBooking } = await testSupabase
        .from("bookings")
        .insert({
          id: generateTestId("blocking-booking"),
          car_id: testCarId,
          customer_id: TEST_FIXTURES.customers[0].id,
          start_date: blockedStartDate,
          end_date: blockedEndDate,
          overall_status: "confirmed",
          payment_status: "paid",
          total_price: 360,
          currency: "USD",
        })
        .select()
        .single();

      // Update car_availability
      const blockedDates = [];
      const currentDate = new Date(blockedStartDate);
      const endDateObj = new Date(blockedEndDate);
      
      while (currentDate <= endDateObj) {
        blockedDates.push({
          car_id: testCarId,
          date: currentDate.toISOString().split("T")[0],
          status: "booked",
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      await testSupabase
        .from("car_availability")
        .upsert(blockedDates, { onConflict: "car_id,date" });

      // Now check availability including the blocked dates
      const { response, data } = await makeAuthenticatedRequest(
        `/api/cars/availability?carId=${testCarId}&startDate=${blockedStartDate}&endDate=${blockedEndDate}`
      );

      expect(response.status).toBe(200);
      expect(data.availability.every((day: any) => !day.available)).toBe(true);
      expect(data.summary.unavailableDays).toBe(data.summary.totalDays);

      // Clean up
      await testSupabase
        .from("bookings")
        .delete()
        .eq("id", blockingBooking.id);

      // Reset availability
      await testSupabase
        .from("car_availability")
        .update({ status: "available" })
        .eq("car_id", testCarId)
        .gte("date", blockedStartDate)
        .lte("date", blockedEndDate);
    });
  });

  describe("Step 2: Create Booking", () => {
    test("should create a new booking", async () => {
      const startDate = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const endDate = new Date(Date.now() + 43 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const bookingData = {
        carId: testCarId,
        startDate,
        endDate,
        customerDetails: testCustomer,
        totalPrice: 480, // 4 days * $120
        currency: "USD",
        securityDepositAmount: 500,
      };

      const { response, data } = await makeAuthenticatedRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify(bookingData),
      });

      expect(response.status).toBe(201);
      expect(data.message).toBe("Booking process initiated successfully!");
      expect(data.bookingId).toBeString();
      expect(data.customerId).toBeString();
      expect(data.bookingUrl).toContain("/booking/");
      expect(data.status).toBe("pending_payment");

      createdBookingId = data.bookingId;
      createdCustomerId = data.customerId;
      
      // Extract token from URL
      const urlParts = data.bookingUrl.split("/");
      bookingToken = urlParts[urlParts.length - 1];
    });

    test("should prevent double booking", async () => {
      const startDate = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const endDate = new Date(Date.now() + 43 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const bookingData = {
        carId: testCarId,
        startDate,
        endDate,
        customerDetails: {
          fullName: "Another User",
          email: "another@example.com",
          phone: "+9876543210",
        },
        totalPrice: 480,
        currency: "USD",
        securityDepositAmount: 500,
      };

      // Try to book the same dates (should fail)
      const { response, data } = await makeAuthenticatedRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify(bookingData),
      });

      // Expecting either 409 (conflict) or 500 with dates_unavailable error
      expect([409, 500]).toContain(response.status);
      if (data.details) {
        expect(data.details).toContain("dates_unavailable");
      }
    });
  });

  describe("Step 3: Verify Booking Creation", () => {
    test("should have created booking in database", async () => {
      expect(createdBookingId).not.toBeNull();

      const { data: booking, error } = await testSupabase
        .from("bookings")
        .select("*, customers(*)")
        .eq("id", createdBookingId)
        .single();

      expect(error).toBeNull();
      expect(booking).toBeDefined();
      expect(booking.car_id).toBe(testCarId);
      expect(booking.overall_status).toBe("pending_payment");
      expect(booking.payment_status).toBe("pending");
      expect(booking.contract_status).toBe("not_sent");
      expect(booking.total_price).toBe(480);
      expect(booking.currency).toBe("USD");
      expect(booking.security_deposit_amount).toBe(500);

      // Verify customer was created
      expect(booking.customers).toBeDefined();
      expect(booking.customers.email).toBe(testCustomer.email);
      expect(booking.customers.first_name).toBe("Integration");
      expect(booking.customers.last_name).toBe("Test User");
    });

    test("should have created secure token", async () => {
      expect(bookingToken).not.toBeNull();

      const { data: token, error } = await testSupabase
        .from("secure_booking_tokens")
        .select("*")
        .eq("booking_id", createdBookingId)
        .single();

      expect(error).toBeNull();
      expect(token).toBeDefined();
      expect(token.token).toBe(bookingToken);
      expect(token.is_used).toBe(false);
      expect(new Date(token.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    test("should have logged booking creation event", async () => {
      const { data: events, error } = await testSupabase
        .from("booking_events")
        .select("*")
        .eq("booking_id", createdBookingId)
        .order("created_at", { ascending: true });

      expect(error).toBeNull();
      expect(events).toBeArray();
      expect(events?.length).toBeGreaterThan(0);

      const creationEvent = events?.find((e: any) => e.event_type === "booking_created");
      expect(creationEvent).toBeDefined();
      expect(creationEvent.actor_type).toBe("system");
    });

    test("should have updated car availability", async () => {
      const startDate = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const endDate = new Date(Date.now() + 43 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { data: availability, error } = await testSupabase
        .from("car_availability")
        .select("*")
        .eq("car_id", testCarId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      expect(error).toBeNull();
      expect(availability).toBeArray();
      expect(availability?.length).toBe(4);
      expect(availability?.every((day: any) => day.status === "booked")).toBe(true);
    });
  });

  describe("Step 4: Simulate Payment Processing", () => {
    test("should handle payment authorization webhook", async () => {
      const webhookPayload = {
        id: `WH-${generateTestId()}`,
        event_type: "PAYMENT.AUTHORIZATION.CREATED",
        resource_type: "payment",
        summary: "Payment authorization created",
        resource: {
          id: "AUTH-123456",
          status: "CREATED",
          amount: {
            currency_code: "USD",
            value: "480.00",
          },
          custom_id: createdBookingId,
        },
        create_time: new Date().toISOString(),
        event_version: "1.0",
      };

      const { response, data } = await makeAuthenticatedRequest(
        "/api/webhooks/paypal",
        {
          method: "POST",
          body: JSON.stringify(webhookPayload),
          headers: {
            "User-Agent": "PayPal/1.0",
            "paypal-auth-algo": "SHA256withRSA",
            "paypal-cert-url": "https://api.paypal.com/cert",
            "paypal-transmission-id": generateTestId(),
            "paypal-transmission-sig": "test-signature",
            "paypal-transmission-time": new Date().toISOString(),
          },
        }
      );

      expect(response.status).toBe(200);
      expect(data.bookingId).toBe(createdBookingId);
      expect(data.eventType).toBe("payment_authorized");

      // Wait for async updates
      await wait(1000);

      // Verify booking was updated
      const { data: booking } = await testSupabase
        .from("bookings")
        .select("payment_status")
        .eq("id", createdBookingId)
        .single();

      expect(booking?.payment_status).toBe("authorized");
    });

    test("should handle payment capture webhook", async () => {
      // First update contract status to signed
      await testSupabase
        .from("bookings")
        .update({ contract_status: "signed" })
        .eq("id", createdBookingId);

      const webhookPayload = {
        id: `WH-${generateTestId()}`,
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource_type: "capture",
        summary: "Payment capture completed",
        resource: {
          id: "CAPTURE-123456",
          status: "COMPLETED",
          amount: {
            currency_code: "USD",
            value: "480.00",
          },
          custom_id: createdBookingId,
        },
        create_time: new Date().toISOString(),
        event_version: "1.0",
      };

      const { response, data } = await makeAuthenticatedRequest(
        "/api/webhooks/paypal",
        {
          method: "POST",
          body: JSON.stringify(webhookPayload),
          headers: {
            "User-Agent": "PayPal/1.0",
            "paypal-auth-algo": "SHA256withRSA",
            "paypal-cert-url": "https://api.paypal.com/cert",
            "paypal-transmission-id": generateTestId(),
            "paypal-transmission-sig": "test-signature",
            "paypal-transmission-time": new Date().toISOString(),
          },
        }
      );

      expect(response.status).toBe(200);
      expect(data.eventType).toBe("payment_captured");

      // Wait for async updates
      await wait(1000);

      // Verify booking was updated to upcoming
      const { data: booking } = await testSupabase
        .from("bookings")
        .select("payment_status, overall_status")
        .eq("id", createdBookingId)
        .single();

      expect(booking?.payment_status).toBe("captured");
      expect(booking?.overall_status).toBe("upcoming");
    });
  });

  describe("Step 5: Verify Final State", () => {
    test("should have complete booking with all events logged", async () => {
      const { data: events, error } = await testSupabase
        .from("booking_events")
        .select("event_type")
        .eq("booking_id", createdBookingId)
        .order("created_at", { ascending: true });

      expect(error).toBeNull();
      expect(events).toBeArray();

      const eventTypes = events?.map((e: any) => e.event_type) || [];
      expect(eventTypes).toContain("booking_created");
      expect(eventTypes).toContain("payment_authorized");
      expect(eventTypes).toContain("payment_captured");
    });

    test("should reflect correct availability after booking", async () => {
      const startDate = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const endDate = new Date(Date.now() + 43 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { response, data } = await makeAuthenticatedRequest(
        `/api/cars/availability?carId=${testCarId}&startDate=${startDate}&endDate=${endDate}`
      );

      expect(response.status).toBe(200);
      expect(data.availability.every((day: any) => !day.available)).toBe(true);
      expect(data.summary.unavailableDays).toBe(4);
    });
  });

  describe("Edge Cases", () => {
    test("should handle concurrent booking attempts", async () => {
      const startDate = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const endDate = new Date(Date.now() + 52 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const bookingData1 = {
        carId: testCarId,
        startDate,
        endDate,
        customerDetails: {
          fullName: "User One",
          email: "user1@example.com",
          phone: "+1111111111",
        },
        totalPrice: 360,
        currency: "USD",
        securityDepositAmount: 500,
      };

      const bookingData2 = {
        carId: testCarId,
        startDate,
        endDate,
        customerDetails: {
          fullName: "User Two",
          email: "user2@example.com",
          phone: "+2222222222",
        },
        totalPrice: 360,
        currency: "USD",
        securityDepositAmount: 500,
      };

      // Send both requests concurrently
      const [response1, response2] = await Promise.all([
        makeAuthenticatedRequest("/api/bookings", {
          method: "POST",
          body: JSON.stringify(bookingData1),
        }),
        makeAuthenticatedRequest("/api/bookings", {
          method: "POST",
          body: JSON.stringify(bookingData2),
        }),
      ]);

      // One should succeed, one should fail
      const statuses = [response1.response.status, response2.response.status];
      expect(statuses).toContain(201); // One success
      expect(statuses.some(s => s === 409 || s === 500)).toBe(true); // One failure

      // Clean up successful booking
      const successfulResponse = response1.response.status === 201 ? response1 : response2;
      if (successfulResponse.data.bookingId) {
        await testSupabase
          .from("bookings")
          .delete()
          .eq("id", successfulResponse.data.bookingId);
      }
    });

    test("should handle booking cancellation", async () => {
      // This would typically be done through a separate cancellation endpoint
      // For now, we'll simulate by updating the booking status
      if (createdBookingId) {
        const { error } = await testSupabase
          .from("bookings")
          .update({ 
            overall_status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", createdBookingId);

        expect(error).toBeNull();

        // Log cancellation event
        const { error: eventError } = await testSupabase
          .from("booking_events")
          .insert({
            booking_id: createdBookingId,
            event_type: "booking_cancelled",
            actor_type: "system",
            summary_text: "Booking cancelled during integration test",
          });

        expect(eventError).toBeNull();

        // Verify availability is restored
        const startDate = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const endDate = new Date(Date.now() + 43 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        // Reset availability
        await testSupabase
          .from("car_availability")
          .update({ status: "available" })
          .eq("car_id", testCarId)
          .gte("date", startDate)
          .lte("date", endDate);

        const { response, data } = await makeAuthenticatedRequest(
          `/api/cars/availability?carId=${testCarId}&startDate=${startDate}&endDate=${endDate}`
        );

        expect(response.status).toBe(200);
        // After cancellation and availability reset, dates should be available
        expect(data.availability.every((day: any) => day.available)).toBe(true);
      }
    });
  });
});