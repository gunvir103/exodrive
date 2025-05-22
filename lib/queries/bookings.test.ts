import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAdminInbox, fetchBookings, fetchBookingById, createBooking, CreateBookingPayload } from "./bookings";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Mock the Supabase client
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

// Default mock implementation for chained Supabase methods
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }), // Default single response
};

describe("Booking Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createSupabaseServiceRoleClient as any).mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.from.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
    mockSupabaseClient.eq.mockReturnThis();
    mockSupabaseClient.in.mockReturnThis();
    mockSupabaseClient.order.mockReturnThis();
    mockSupabaseClient.upsert.mockReturnThis();
    mockSupabaseClient.insert.mockReturnThis();
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: null });
  });

  describe("fetchAdminInbox", () => {
    it("should fetch pending bookings ordered by created_at descending", async () => {
      const mockPendingBookings = [
        { id: "1", status: "pending", created_at: "2023-01-01T10:00:00Z" },
        { id: "2", status: "pending", created_at: "2023-01-02T10:00:00Z" },
      ];
      // Specific mock for this test case, chained correctly
      mockSupabaseClient.from.mockReturnThis(); // bookings
      mockSupabaseClient.select.mockReturnThis(); // select string
      mockSupabaseClient.eq.mockReturnThis(); // status, pending
      mockSupabaseClient.order.mockResolvedValueOnce({ data: mockPendingBookings, error: null }); // created_at

      const result = await fetchAdminInbox();

      expect(createSupabaseServiceRoleClient).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("bookings");
      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        `*, car:cars(id, name, slug, car_images(url, is_primary)), customer:customers(id, first_name, last_name, email, phone)`
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("status", "pending");
      expect(mockSupabaseClient.order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(result).toEqual(mockPendingBookings);
    });

    it("should throw an error if Supabase call fails", async () => {
      const errorMessage = "Supabase error";
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.order.mockResolvedValueOnce({ data: null, error: { message: errorMessage } });

      await expect(fetchAdminInbox()).rejects.toThrow(errorMessage);
    });
  });

  // Tests for fetchBookings
  describe("fetchBookings", () => {
    it("should fetch bookings with specified statuses", async () => {
      const mockBookingsData = [{ id: "1", status: "active" }];
      const statuses = ["active", "completed"];
      
      mockSupabaseClient.from.mockReturnThis(); // bookings
      mockSupabaseClient.select.mockReturnThis(); // select string
      mockSupabaseClient.order.mockReturnThis(); // created_at
      mockSupabaseClient.in.mockResolvedValueOnce({ data: mockBookingsData, error: null }); // status, statuses

      const result = await fetchBookings(statuses);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("bookings");
      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        `*, car:cars(id, name, slug, car_images(url, is_primary)), customer:customers(id, first_name, last_name, email, phone)`
      );
      expect(mockSupabaseClient.order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockSupabaseClient.in).toHaveBeenCalledWith("status", statuses);
      expect(result).toEqual(mockBookingsData);
    });

    it("should fetch all bookings if statuses array is empty", async () => {
      const mockAllBookings = [{ id: "1" }, { id: "2" }];
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      // .in should not be called, .order is the final call in this chain if no statuses
      mockSupabaseClient.order.mockResolvedValueOnce({ data: mockAllBookings, error: null }); 

      const result = await fetchBookings([]);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("bookings");
      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        `*, car:cars(id, name, slug, car_images(url, is_primary)), customer:customers(id, first_name, last_name, email, phone)`
      );
      expect(mockSupabaseClient.order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockSupabaseClient.in).not.toHaveBeenCalled();
      expect(result).toEqual(mockAllBookings);
    });

    it("should throw an error if Supabase call fails for fetchBookings", async () => {
      const errorMessage = "Fetch bookings error";
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.in.mockResolvedValueOnce({ data: null, error: { message: errorMessage } });
      
      await expect(fetchBookings(["active"])).rejects.toThrow(errorMessage);
    });
  });

  // Tests for fetchBookingById
  describe("fetchBookingById", () => {
    it("should fetch a single booking by ID", async () => {
      const mockBooking = { id: "123", car_id: "c1" };
      mockSupabaseClient.from.mockReturnThis(); // bookings
      mockSupabaseClient.select.mockReturnThis(); // select string
      mockSupabaseClient.eq.mockReturnThis(); // id, bookingId
      mockSupabaseClient.single.mockResolvedValueOnce({ data: mockBooking, error: null });

      const result = await fetchBookingById("123");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("bookings");
      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        `*, car:cars(id, name, slug, car_images(url, is_primary)), customer:customers(id, first_name, last_name, email, phone)`
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("id", "123");
      expect(mockSupabaseClient.single).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockBooking);
    });

    it("should throw an error if Supabase call fails for fetchBookingById", async () => {
      const errorMessage = "Fetch by ID error";
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { message: errorMessage } });

      await expect(fetchBookingById("123")).rejects.toThrow(errorMessage);
    });
  });

  // Tests for createBooking
  describe("createBooking", () => {
    const payload: CreateBookingPayload = {
      carId: "car1",
      startDate: "2023-01-01",
      endDate: "2023-01-03",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      totalPrice: 300,
      phone: "1234567890",
      currency: "USD",
      notes: "Test booking",
    };
    const mockCustomer = { id: "cust1", email: payload.email, first_name: payload.firstName, last_name: payload.lastName };
    const mockBooking = { id: "book1", car_id: payload.carId, customer_id: mockCustomer.id, total_price: payload.totalPrice };

    it("should upsert customer, insert booking, and insert availability rows", async () => {
      // Mock customer upsert
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'customers') {
          return {
            ...mockSupabaseClient,
            upsert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: mockCustomer, error: null })
          };
        }
        if (table === 'bookings') {
           return {
            ...mockSupabaseClient,
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: mockBooking, error: null })
          };
        }
        if (table === 'car_availability') {
          return {
            ...mockSupabaseClient,
            upsert: vi.fn().mockResolvedValueOnce({ error: null }) // availability upsert
          };
        }
        return mockSupabaseClient; // Default
      });
      
      const result = await createBooking(payload);

      // Check customer upsert
      const customerUpsertMock = (mockSupabaseClient.from as any).mock.results[0].value.upsert;
      expect(customerUpsertMock).toHaveBeenCalledWith(
        { email: payload.email, first_name: payload.firstName, last_name: payload.lastName, phone: payload.phone ?? null }, 
        { onConflict: "email" }
      );

      // Check booking insert
      const bookingInsertMock = (mockSupabaseClient.from as any).mock.results[1].value.insert;
      expect(bookingInsertMock).toHaveBeenCalledWith({
        car_id: payload.carId,
        customer_id: mockCustomer.id,
        start_date: payload.startDate,
        end_date: payload.endDate,
        total_price: payload.totalPrice,
        currency: payload.currency,
        notes: payload.notes ?? null,
      });
      
      // Check availability insert
      const availabilityUpsertMock = (mockSupabaseClient.from as any).mock.results[2].value.upsert;
      const expectedAvailabilityRows = [
        { car_id: payload.carId, date: "2023-01-01", status: "pending", booking_id: mockBooking.id },
        { car_id: payload.carId, date: "2023-01-02", status: "pending", booking_id: mockBooking.id },
        { car_id: payload.carId, date: "2023-01-03", status: "pending", booking_id: mockBooking.id },
      ];
      expect(availabilityUpsertMock).toHaveBeenCalledWith(expectedAvailabilityRows, { onConflict: "car_id,date" });
      expect(result).toEqual(mockBooking);
    });

    it("should throw error if customer upsert fails", async () => {
      const customerError = { message: "Customer upsert failed" };
      mockSupabaseClient.from.mockImplementationOnce((table: string) => { // Only for customers table call
        if (table === 'customers') {
          return {
            ...mockSupabaseClient,
            upsert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: null, error: customerError })
          };
        }
        return mockSupabaseClient;
      });
      await expect(createBooking(payload)).rejects.toThrow(customerError.message);
    });

    it("should throw error if booking insert fails", async () => {
      const bookingError = { message: "Booking insert failed" };
       mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'customers') {
          return {
            ...mockSupabaseClient,
            upsert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: mockCustomer, error: null })
          };
        }
        if (table === 'bookings') {
           return {
            ...mockSupabaseClient,
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: null, error: bookingError })
          };
        }
        return mockSupabaseClient;
      });
      await expect(createBooking(payload)).rejects.toThrow(bookingError.message);
    });

    it("should log error if availability insert fails but still return booking data", async () => {
      const availabilityError = { message: "Availability insert failed" };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'customers') {
          return {
            ...mockSupabaseClient,
            upsert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: mockCustomer, error: null })
          };
        }
        if (table === 'bookings') {
           return {
            ...mockSupabaseClient,
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: mockBooking, error: null })
          };
        }
        if (table === 'car_availability') {
          return {
            ...mockSupabaseClient,
            upsert: vi.fn().mockResolvedValueOnce({ error: availabilityError })
          };
        }
        return mockSupabaseClient;
      });

      const result = await createBooking(payload);
      expect(result).toEqual(mockBooking); // Should still return booking data
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error inserting availability rows", availabilityError);
      consoleErrorSpy.mockRestore();
    });
  });
}); 