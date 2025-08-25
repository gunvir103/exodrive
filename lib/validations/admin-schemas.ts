import { z } from 'zod';

// Admin authentication schema
export const AdminAuthSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'super_admin'])
});

// Analytics query schema
export const AnalyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metric: z.enum(['revenue', 'bookings', 'utilization', 'customers']).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional().default('month')
});

// Cache warming schema
export const CacheWarmingSchema = z.object({
  targets: z.array(z.enum(['cars', 'reviews', 'bookings', 'all'])).default(['all']),
  force: z.boolean().default(false)
});

// Analytics response schemas
export const RevenueMetricsSchema = z.object({
  totalRevenue: z.number(),
  averageBookingValue: z.number(),
  revenueByPeriod: z.array(z.object({
    period: z.string(),
    revenue: z.number(),
    bookingCount: z.number()
  }))
});

export const BookingMetricsSchema = z.object({
  totalBookings: z.number(),
  activeBookings: z.number(),
  completedBookings: z.number(),
  cancelledBookings: z.number(),
  averageBookingDuration: z.number(),
  bookingsByStatus: z.record(z.string(), z.number())
});

export const CustomerMetricsSchema = z.object({
  totalCustomers: z.number(),
  newCustomers: z.number(),
  returningCustomers: z.number(),
  averageBookingsPerCustomer: z.number(),
  topCustomers: z.array(z.object({
    customerId: z.string().uuid(),
    name: z.string(),
    totalBookings: z.number(),
    totalSpent: z.number()
  }))
});

export const UtilizationMetricsSchema = z.object({
  averageUtilization: z.number(),
  utilizationByVehicle: z.array(z.object({
    carId: z.string().uuid(),
    carName: z.string(),
    utilizationRate: z.number(),
    totalDaysBooked: z.number(),
    totalDaysAvailable: z.number()
  })),
  peakUtilizationPeriods: z.array(z.object({
    period: z.string(),
    utilizationRate: z.number()
  }))
});

// Type exports
export type AdminAuth = z.infer<typeof AdminAuthSchema>;
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
export type CacheWarming = z.infer<typeof CacheWarmingSchema>;
export type RevenueMetrics = z.infer<typeof RevenueMetricsSchema>;
export type BookingMetrics = z.infer<typeof BookingMetricsSchema>;
export type CustomerMetrics = z.infer<typeof CustomerMetricsSchema>;
export type UtilizationMetrics = z.infer<typeof UtilizationMetricsSchema>;