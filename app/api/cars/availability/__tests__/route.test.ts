import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { 
  createMockSupabaseClient, 
  mockCreateSupabaseServerClient,
  createChainableMock
} from "@/tests/mocks/supabase";
import { createMockCacheService } from "@/tests/mocks/redis";

// Mock modules
mock.module("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

const mockCacheService = createMockCacheService();
const mockCacheConfigs = {
  carAvailability: {
    keyPrefix: "car:availability",
    ttl: 300, // 5 minutes
  },
};

mock.module("@/lib/redis", () => ({
  cacheService: mockCacheService,
  cacheConfigs: mockCacheConfigs,
}));

const mockWithApiErrorHandling = (handler: Function) => handler;
const mockPublicRateLimit = (handler: Function) => handler;

mock.module("@/lib/errors", () => ({
  withApiErrorHandling: mockWithApiErrorHandling,
}));

mock.module("@/lib/rate-limit", () => ({
  publicRateLimit: mockPublicRateLimit,
}));

describe("GET /api/cars/availability", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mock.restore();
    mockSupabase = createMockSupabaseClient();
    mockCreateSupabaseServerClient.mockReturnValue(mockSupabase);
    mockCacheService.get.mockClear();
    mockCacheService.set.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  const createRequest = (params: Record<string, string>) => {
    const url = new URL("http://localhost:3000/api/cars/availability");
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return new NextRequest(url.toString(), {
      method: "GET",
    });
  };

  const validParams = {
    carId: "550e8400-e29b-41d4-a716-446655440001",
    startDate: "2024-12-20",
    endDate: "2024-12-23",
  };

  describe("Validation", () => {
    test("should reject missing parameters", async () => {
      const request = createRequest({});
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request parameters");
      expect(data.details).toBeDefined();
    });

    test("should reject invalid car ID format", async () => {
      const request = createRequest({
        ...validParams,
        carId: "invalid-uuid",
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request parameters");
    });

    test("should reject invalid date format", async () => {
      const request = createRequest({
        ...validParams,
        startDate: "2024/12/20", // Wrong format
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request parameters");
    });

    test("should reject start date after end date", async () => {
      // Mock empty availability data
      mockSupabase.from = mock(() => 
        createChainableMock({
          data: [],
          error: null,
        })
      );

      const request = createRequest({
        ...validParams,
        startDate: "2024-12-25",
        endDate: "2024-12-20",
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Start date must be before or equal to end date");
    });
  });

  describe("Caching", () => {
    test("should return cached data when available", async () => {
      const cachedData = {
        carId: validParams.carId,
        startDate: validParams.startDate,
        endDate: validParams.endDate,
        availability: [
          { date: "2024-12-20", available: true, status: "available" },
          { date: "2024-12-21", available: true, status: "available" },
          { date: "2024-12-22", available: false, status: "booked" },
          { date: "2024-12-23", available: true, status: "available" },
        ],
        summary: {
          totalDays: 4,
          availableDays: 3,
          unavailableDays: 1,
        },
      };

      mockCacheService.get.mockResolvedValueOnce(cachedData);

      const request = createRequest(validParams);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(cachedData);
      expect(response.headers.get("X-Cache")).toBe("HIT");
      expect(response.headers.get("X-Cache-Key")).toContain("car:availability");
      
      // Should not call Supabase when cache hit
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    test("should cache data after database query", async () => {
      const availabilityData = [
        { date: "2024-12-20", status: "available" },
        { date: "2024-12-21", status: "available" },
        { date: "2024-12-22", status: "booked" },
        { date: "2024-12-23", status: "available" },
      ];

      mockCacheService.get.mockResolvedValueOnce(null); // Cache miss

      let fromCallCount = 0;
      mockSupabase.from = mock((table: string) => {
        fromCallCount++;
        if (table === "car_availability") {
          return createChainableMock({
            data: availabilityData,
            error: null,
          });
        }
        if (table === "bookings") {
          return createChainableMock({
            data: [],
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validParams);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Cache")).toBe("MISS");
      
      // Verify cache was set
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining("car:availability"),
        expect.objectContaining({
          carId: validParams.carId,
          availability: expect.any(Array),
        }),
        mockCacheConfigs.carAvailability.ttl
      );
    });
  });

  describe("Availability Calculation", () => {
    test("should calculate availability from car_availability table", async () => {
      const availabilityData = [
        { date: "2024-12-20", status: "available" },
        { date: "2024-12-21", status: "maintenance" },
        { date: "2024-12-22", status: "booked" },
        { date: "2024-12-23", status: "available" },
      ];

      mockCacheService.get.mockResolvedValueOnce(null);

      mockSupabase.from = mock((table: string) => {
        if (table === "car_availability") {
          return createChainableMock({
            data: availabilityData,
            error: null,
          });
        }
        if (table === "bookings") {
          return createChainableMock({
            data: [],
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validParams);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.availability).toHaveLength(4);
      expect(data.availability[0]).toEqual({
        date: "2024-12-20",
        available: true,
        status: "available",
      });
      expect(data.availability[1]).toEqual({
        date: "2024-12-21",
        available: false,
        status: "maintenance",
      });
      expect(data.availability[2]).toEqual({
        date: "2024-12-22",
        available: false,
        status: "booked",
      });
      expect(data.summary).toEqual({
        totalDays: 4,
        availableDays: 2,
        unavailableDays: 2,
      });
    });

    test("should fill missing dates as available", async () => {
      // Only partial data in car_availability
      const availabilityData = [
        { date: "2024-12-21", status: "booked" },
      ];

      mockCacheService.get.mockResolvedValueOnce(null);

      mockSupabase.from = mock((table: string) => {
        if (table === "car_availability") {
          return createChainableMock({
            data: availabilityData,
            error: null,
          });
        }
        if (table === "bookings") {
          return createChainableMock({
            data: [],
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validParams);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.availability).toHaveLength(4);
      
      // Check that missing dates default to available
      expect(data.availability[0].available).toBe(true);
      expect(data.availability[0].status).toBe("available");
      expect(data.availability[1].available).toBe(false);
      expect(data.availability[1].status).toBe("booked");
      expect(data.availability[2].available).toBe(true);
      expect(data.availability[3].available).toBe(true);
    });

    test("should overlay booking data on availability", async () => {
      const availabilityData: any[] = []; // Empty availability table

      const bookingsData = [
        {
          id: "booking-123",
          start_date: "2024-12-21",
          end_date: "2024-12-22",
          overall_status: "confirmed",
        },
      ];

      mockCacheService.get.mockResolvedValueOnce(null);

      mockSupabase.from = mock((table: string) => {
        if (table === "car_availability") {
          return createChainableMock({
            data: availabilityData,
            error: null,
          });
        }
        if (table === "bookings") {
          return createChainableMock({
            data: bookingsData,
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validParams);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.availability[1].available).toBe(false);
      expect(data.availability[1].status).toBe("booked");
      expect(data.availability[2].available).toBe(false);
      expect(data.availability[2].status).toBe("booked");
    });

    test("should exclude cancelled bookings", async () => {
      const bookingsData = [
        {
          id: "booking-123",
          start_date: "2024-12-21",
          end_date: "2024-12-22",
          overall_status: "cancelled", // Should be ignored
        },
      ];

      mockCacheService.get.mockResolvedValueOnce(null);

      mockSupabase.from = mock((table: string) => {
        if (table === "car_availability") {
          return createChainableMock({
            data: [],
            error: null,
          });
        }
        if (table === "bookings") {
          const chainable = createChainableMock({
            data: bookingsData,
            error: null,
          });
          
          // Mock the .not() filter to exclude cancelled bookings
          chainable.not = mock(() => {
            chainable.then = mock((resolve: Function) => {
              resolve({ data: [], error: null }); // Return empty array (cancelled booking filtered out)
              return Promise.resolve({ data: [], error: null });
            });
            return chainable;
          });
          
          return chainable;
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validParams);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // All dates should be available since cancelled booking is excluded
      expect(data.availability.every((day: any) => day.available)).toBe(true);
    });
  });

  describe("Database Query", () => {
    test("should query with correct date filters", async () => {
      mockCacheService.get.mockResolvedValueOnce(null);

      let carAvailabilityQuery: any;
      let bookingsQuery: any;

      mockSupabase.from = mock((table: string) => {
        const chainable = createChainableMock({
          data: [],
          error: null,
        });

        if (table === "car_availability") {
          carAvailabilityQuery = {
            table,
            filters: [],
          };
          
          chainable.eq = mock((field: string, value: any) => {
            carAvailabilityQuery.filters.push({ eq: [field, value] });
            return chainable;
          });
          chainable.gte = mock((field: string, value: any) => {
            carAvailabilityQuery.filters.push({ gte: [field, value] });
            return chainable;
          });
          chainable.lte = mock((field: string, value: any) => {
            carAvailabilityQuery.filters.push({ lte: [field, value] });
            return chainable;
          });
        }

        if (table === "bookings") {
          bookingsQuery = {
            table,
            filters: [],
          };
          
          chainable.eq = mock((field: string, value: any) => {
            bookingsQuery.filters.push({ eq: [field, value] });
            return chainable;
          });
          chainable.gte = mock((field: string, value: any) => {
            bookingsQuery.filters.push({ gte: [field, value] });
            return chainable;
          });
          chainable.lte = mock((field: string, value: any) => {
            bookingsQuery.filters.push({ lte: [field, value] });
            return chainable;
          });
        }

        return chainable;
      });

      const request = createRequest(validParams);
      await GET(request);

      // Verify car_availability query
      expect(carAvailabilityQuery.filters).toContainEqual({
        eq: ["car_id", validParams.carId],
      });
      expect(carAvailabilityQuery.filters).toContainEqual({
        gte: ["date", validParams.startDate],
      });
      expect(carAvailabilityQuery.filters).toContainEqual({
        lte: ["date", validParams.endDate],
      });

      // Verify bookings query
      expect(bookingsQuery.filters).toContainEqual({
        eq: ["car_id", validParams.carId],
      });
      expect(bookingsQuery.filters).toContainEqual({
        gte: ["end_date", validParams.startDate],
      });
      expect(bookingsQuery.filters).toContainEqual({
        lte: ["start_date", validParams.endDate],
      });
    });
  });

  describe("Error Handling", () => {
    test("should handle car_availability query error", async () => {
      mockCacheService.get.mockResolvedValueOnce(null);

      mockSupabase.from = mock((table: string) => {
        if (table === "car_availability") {
          return createChainableMock({
            data: null,
            error: { message: "Database error" },
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validParams);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch availability data");
    });

    test("should continue if bookings query fails", async () => {
      mockCacheService.get.mockResolvedValueOnce(null);

      const consoleSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleSpy;

      mockSupabase.from = mock((table: string) => {
        if (table === "car_availability") {
          return createChainableMock({
            data: [],
            error: null,
          });
        }
        if (table === "bookings") {
          return createChainableMock({
            data: null,
            error: { message: "Bookings query failed" },
          });
        }
        return createChainableMock({ data: null, error: null });
      });

      const request = createRequest(validParams);
      const response = await GET(request);
      const data = await response.json();

      // Should still return 200 with availability data
      expect(response.status).toBe(200);
      expect(data.availability).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching bookings:",
        expect.any(Object)
      );

      console.error = originalError;
    });

    test("should handle unexpected errors", async () => {
      mockCacheService.get.mockRejectedValueOnce(new Error("Cache error"));

      const request = createRequest(validParams);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(data.details).toBe("Cache error");
    });
  });

  describe("Date Range Handling", () => {
    test("should handle single day range", async () => {
      mockCacheService.get.mockResolvedValueOnce(null);

      mockSupabase.from = mock(() =>
        createChainableMock({
          data: [],
          error: null,
        })
      );

      const request = createRequest({
        ...validParams,
        startDate: "2024-12-20",
        endDate: "2024-12-20",
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.availability).toHaveLength(1);
      expect(data.availability[0].date).toBe("2024-12-20");
    });

    test("should handle month-long range", async () => {
      mockCacheService.get.mockResolvedValueOnce(null);

      mockSupabase.from = mock(() =>
        createChainableMock({
          data: [],
          error: null,
        })
      );

      const request = createRequest({
        ...validParams,
        startDate: "2024-12-01",
        endDate: "2024-12-31",
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.availability).toHaveLength(31);
      expect(data.summary.totalDays).toBe(31);
    });
  });
});