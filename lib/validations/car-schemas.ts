import { z } from 'zod';

// Base schemas for individual entities
export const CarPricingSchema = z.object({
  base_price: z.number().min(0).describe('Daily rental price'),
  currency: z.string().default('USD').describe('Currency code'),
  deposit_amount: z.number().min(0).describe('Security deposit amount'),
  discount_percentage: z.number().min(0).max(100).nullable().optional(),
  minimum_days: z.number().int().min(1).default(1),
  special_offer_text: z.string().max(200).nullable().optional()
});

export const CarImageSchema = z.object({
  url: z.string().url().describe('Image URL'),
  alt: z.string().max(200).nullable().optional().describe('Alt text for accessibility'),
  is_primary: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
  path: z.string().nullable().optional().describe('Storage path for deletion')
});

export const CarFeatureSchema = z.object({
  name: z.string().min(1).max(100).describe('Feature name'),
  description: z.string().max(500).nullable().optional(),
  is_highlighted: z.boolean().default(false)
});

export const CarSpecificationSchema = z.object({
  name: z.string().min(1).max(100).describe('Specification name'),
  value: z.string().min(1).max(200).describe('Specification value'),
  category: z.string().max(50).nullable().optional().describe('Specification category (e.g., "Engine", "Dimensions")'),
  sort_order: z.number().int().min(0).default(0)
});

// Main car schema for creation/updates
export const CarUpsertSchema = z.object({
  name: z.string().min(1).max(100).describe('Car name for display and slug generation'),
  category: z.string().min(1).max(50).describe('Car category (e.g., "Luxury", "SUV", "Economy")'),
  description: z.string().max(2000).nullable().optional().describe('Full car description'),
  short_description: z.string().max(200).nullable().optional().describe('Brief description for listings'),
  available: z.boolean().nullable().optional().default(true),
  featured: z.boolean().nullable().optional().default(false),
  hidden: z.boolean().nullable().optional().default(false),
  
  // Related data
  pricing: CarPricingSchema,
  images: z.array(CarImageSchema).min(1).max(20).describe('At least one image is required'),
  features: z.array(CarFeatureSchema).max(50).default([]),
  specifications: z.array(CarSpecificationSchema).max(100).default([])
});

// Partial schema for updates (all fields optional except id)
export const CarUpdateSchema = CarUpsertSchema.partial().extend({
  pricing: CarPricingSchema.optional(),
  images: z.array(CarImageSchema).min(1).max(20).optional()
});

// Schema for car ID validation
export const CarIdSchema = z.string().uuid('Invalid car ID format');

// Schema for slug validation
export const CarSlugSchema = z.string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens');

// Query parameter schemas
export const CarListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  featured: z.coerce.boolean().optional(),
  available: z.coerce.boolean().optional(),
  includeHidden: z.coerce.boolean().optional().default(false),
  sortBy: z.enum(['created_at', 'updated_at', 'name', 'price']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

// Response schemas for API consistency
export const CarListResponseSchema = z.object({
  cars: z.array(z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    category: z.string().nullable(),
    available: z.boolean().nullable(),
    featured: z.boolean().nullable(),
    hidden: z.boolean().nullable(),
    created_at: z.string().nullable(),
    primary_image_url: z.string().url().nullable().optional(),
    price_per_day: z.number().nullable().optional(),
    shortDescription: z.string().nullable().optional()
  })),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  }).optional()
});

export const CarDetailResponseSchema = z.object({
  car: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    category: z.string().nullable(),
    description: z.string().nullable(),
    short_description: z.string().nullable(),
    available: z.boolean(),
    featured: z.boolean(),
    hidden: z.boolean(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    pricing: z.object({
      base_price: z.number(),
      currency: z.string(),
      deposit_amount: z.number(),
      discount_percentage: z.number().nullable(),
      minimum_days: z.number(),
      special_offer_text: z.string().nullable()
    }).nullable(),
    images: z.array(z.object({
      id: z.string().uuid(),
      url: z.string().url(),
      alt: z.string().nullable(),
      is_primary: z.boolean(),
      sort_order: z.number()
    })),
    features: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string().nullable(),
      is_highlighted: z.boolean()
    })),
    specifications: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      value: z.string(),
      category: z.string().nullable(),
      sort_order: z.number()
    }))
  })
});

// Export type inference helpers
export type CarUpsert = z.infer<typeof CarUpsertSchema>;
export type CarUpdate = z.infer<typeof CarUpdateSchema>;
export type CarListQuery = z.infer<typeof CarListQuerySchema>;
export type CarListResponse = z.infer<typeof CarListResponseSchema>;
export type CarDetailResponse = z.infer<typeof CarDetailResponseSchema>;