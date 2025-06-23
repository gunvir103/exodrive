import { z } from 'zod';

// Booking status enums
export const BookingOverallStatus = z.enum([
  'pending_payment',
  'active',
  'upcoming',
  'completed',
  'cancelled'
]);

export const PaymentStatus = z.enum([
  'pending',
  'authorized',
  'captured',
  'partially_captured',
  'refunded',
  'partially_refunded',
  'failed',
  'voided'
]);

export const ContractStatus = z.enum([
  'not_required',
  'pending',
  'sent',
  'signed',
  'expired'
]);

// Create booking schema
export const CreateBookingSchema = z.object({
  carId: z.string().uuid('Invalid car ID format'),
  customerId: z.string().uuid('Invalid customer ID format'),
  startDate: z.string().datetime({ message: 'Invalid start date format' }),
  endDate: z.string().datetime({ message: 'Invalid end date format' }),
  pickupLocation: z.string().min(1).max(500),
  dropoffLocation: z.string().min(1).max(500),
  totalPrice: z.number().positive('Total price must be positive'),
  currency: z.string().length(3).default('USD'),
  bookingDays: z.number().int().positive('Booking days must be positive'),
  securityDepositAmount: z.number().min(0),
  notes: z.string().max(1000).optional()
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: 'End date must be after start date' }
);

// Update booking status schema
export const UpdateBookingStatusSchema = z.object({
  overallStatus: BookingOverallStatus.optional(),
  paymentStatus: PaymentStatus.optional(),
  contractStatus: ContractStatus.optional(),
  notes: z.string().max(1000).optional()
});

// Booking query parameters
export const BookingQuerySchema = z.object({
  status: z.enum(['all', 'active', 'upcoming', 'completed', 'cancelled', 'pending_payment']).optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['created_at', 'start_date', 'end_date', 'total_price']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Booking response schema
export const BookingResponseSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  carId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  totalPrice: z.number(),
  currency: z.string(),
  overallStatus: BookingOverallStatus,
  paymentStatus: PaymentStatus,
  contractStatus: ContractStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
  bookingDays: z.number(),
  securityDepositAmount: z.number(),
  pickupLocation: z.string(),
  dropoffLocation: z.string(),
  notes: z.string().nullable(),
  customer: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string().nullable()
  }).optional(),
  car: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    category: z.string().nullable()
  }).optional()
});

// Type exports
export type CreateBooking = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingStatus = z.infer<typeof UpdateBookingStatusSchema>;
export type BookingQuery = z.infer<typeof BookingQuerySchema>;
export type BookingResponse = z.infer<typeof BookingResponseSchema>;