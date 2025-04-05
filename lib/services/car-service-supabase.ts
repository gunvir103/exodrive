import { handleSupabaseError } from "@/lib/supabase/client"
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { cookies } from 'next/headers'
import type { Car } from "@/lib/types/car"
import { BUCKET_NAMES } from "@/lib/supabase/storage-service"
import type { SupabaseClient } from '@supabase/supabase-js'

// Define a type for the database row (adjust based on exact schema if needed)
// This helps ensure consistency when interacting with the DB
type CarDbRow = {
  id: string;
  slug: string;
  name: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  category: string;
  description?: string | null;
  short_description?: string | null;
  price_per_day: number;
  deposit_amount?: number | null;
  engine?: string | null;
  horsepower?: number | null;
  acceleration_0_60?: number | null;
  top_speed?: number | null;
  transmission?: string | null;
  drivetrain?: string | null;
  features?: Record<string, any> | null; // JSONB
  specifications?: Record<string, any> | null; // JSONB
  image_urls?: string[] | null; // TEXT[]
  available?: boolean | null;
  is_featured?: boolean | null;
  hidden?: boolean | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// Simplified Car type for the application layer (adjust as needed)
// This might be slightly different from the DB row (e.g., dates as Date objects)
// We will likely need to update the definition in @/lib/types/car.ts separately
type AppCar = {
  id: string;
  slug: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  category: string;
  description?: string;
  shortDescription?: string;
  pricePerDay: number;
  depositAmount?: number;
  engine?: string;
  horsepower?: number;
  acceleration060?: number;
  topSpeed?: number;
  transmission?: string;
  drivetrain?: string;
  features?: Record<string, any>; // JSONB
  specifications?: Record<string, any>; // JSONB
  imageUrls?: string[]; // TEXT[]
  isAvailable: boolean;
  isFeatured: boolean;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Helper function to transform DB row to AppCar type
function transformDbRowToAppCar(row: CarDbRow): AppCar {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    make: row.make ?? undefined,
    model: row.model ?? undefined,
    year: row.year ?? undefined,
    category: row.category,
    description: row.description ?? undefined,
    shortDescription: row.short_description ?? undefined,
    pricePerDay: row.price_per_day,
    depositAmount: row.deposit_amount ?? undefined,
    engine: row.engine ?? undefined,
    horsepower: row.horsepower ?? undefined,
    acceleration060: row.acceleration_0_60 ?? undefined,
    topSpeed: row.top_speed ?? undefined,
    transmission: row.transmission ?? undefined,
    drivetrain: row.drivetrain ?? undefined,
    features: row.features ?? {}, // Default to empty object
    specifications: row.specifications ?? {}, // Default to empty object
    imageUrls: row.image_urls ?? [], // Default to empty array
    isAvailable: row.available ?? true,
    isFeatured: row.is_featured ?? false,
    isHidden: row.hidden ?? false,
    createdAt: new Date(row.created_at ?? 0),
    updatedAt: new Date(row.updated_at ?? 0),
  };
}

// Helper function to transform AppCar type for DB insertion/update
// (Handles potential snake_case conversion if needed, though Supabase often handles it)
function transformAppCarToDbPayload(carData: Partial<AppCar>): Partial<CarDbRow> {
    const payload: Partial<CarDbRow> = {};
    if (carData.slug !== undefined) payload.slug = carData.slug;
    if (carData.name !== undefined) payload.name = carData.name;
    if (carData.make !== undefined) payload.make = carData.make;
    if (carData.model !== undefined) payload.model = carData.model;
    if (carData.year !== undefined) payload.year = carData.year;
    if (carData.category !== undefined) payload.category = carData.category;
    if (carData.description !== undefined) payload.description = carData.description;
    if (carData.shortDescription !== undefined) payload.short_description = carData.shortDescription;
    if (carData.pricePerDay !== undefined) payload.price_per_day = carData.pricePerDay;
    if (carData.depositAmount !== undefined) payload.deposit_amount = carData.depositAmount;
    if (carData.engine !== undefined) payload.engine = carData.engine;
    if (carData.horsepower !== undefined) payload.horsepower = carData.horsepower;
    if (carData.acceleration060 !== undefined) payload.acceleration_0_60 = carData.acceleration060;
    if (carData.topSpeed !== undefined) payload.top_speed = carData.topSpeed;
    if (carData.transmission !== undefined) payload.transmission = carData.transmission;
    if (carData.drivetrain !== undefined) payload.drivetrain = carData.drivetrain;
    if (carData.features !== undefined) payload.features = carData.features;
    if (carData.specifications !== undefined) payload.specifications = carData.specifications;
    if (carData.imageUrls !== undefined) payload.image_urls = carData.imageUrls;
    if (carData.isAvailable !== undefined) payload.available = carData.isAvailable;
    if (carData.isFeatured !== undefined) payload.is_featured = carData.isFeatured;
    if (carData.isHidden !== undefined) payload.hidden = carData.isHidden;
    // created_by, created_at, updated_at are handled by DB/Auth or triggers

    return payload;
}

export const carServiceSupabase = {
  /**
   * Get all cars (Respects RLS of the provided client)
   */
  getAllCars: async (supabase: SupabaseClient): Promise<AppCar[]> => {
    try {
      const { data, error } = await supabase
        .from("cars")
        .select<"*", CarDbRow>("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data.map(transformDbRowToAppCar);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(handleSupabaseError(error));
      }
      throw new Error("An unexpected error occurred fetching all cars");
    }
  },

  /**
   * Get visible cars (Filters based on columns, respects client's RLS)
   */
  getVisibleCars: async (supabase: SupabaseClient): Promise<AppCar[]> => {
    try {
      const { data, error } = await supabase
        .from("cars")
        .select<"*", CarDbRow>("*")
        .eq("available", true)
        .eq("hidden", false)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase query error in getVisibleCars:", error); // Log Supabase specific error
        throw error; // Re-throw Supabase error to be caught below
      }
      return data.map(transformDbRowToAppCar);
    } catch (error) {
      // Log the raw error object HERE to inspect its type and content
      console.error("***** RAW ERROR caught in getVisibleCars *****:", JSON.stringify(error, null, 2), error);
      
      if (error instanceof Error) {
        // This might handle standard JS errors or correctly thrown Supabase errors
        throw new Error(handleSupabaseError(error));
      }
      // Handle cases where the caught object might have a message property but isn't an Error instance
      if (typeof error === 'object' && error !== null && 'message' in error) {
         throw new Error(handleSupabaseError(error)); // Pass to handler
      }
      // Fallback for truly unknown errors
      throw new Error("An unexpected error occurred fetching visible cars");
    }
  },

  /**
   * Get car by ID (Respects client's RLS)
   */
  getCarById: async (supabase: SupabaseClient, id: string): Promise<AppCar | null> => {
    try {
      const { data, error } = await supabase
        .from("cars")
        .select<"*", CarDbRow>("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return transformDbRowToAppCar(data);
    } catch (error) {
       if (error instanceof Error) {
        throw new Error(handleSupabaseError(error));
      }
      throw new Error("An unexpected error occurred fetching car by ID");
    }
  },

  /**
   * Get car by slug (Respects client's RLS)
   */
  getCarBySlug: async (supabase: SupabaseClient, slug: string): Promise<AppCar | null> => {
    try {
      const { data, error } = await supabase
        .from("cars")
        .select<"*", CarDbRow>("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return transformDbRowToAppCar(data);
    } catch (error) {
       if (error instanceof Error) {
        throw new Error(handleSupabaseError(error));
      }
      throw new Error("An unexpected error occurred fetching car by slug");
    }
  },

  /**
   * Create a new car (Uses the provided client - likely Service Role)
   * Needs authClient passed separately if user association is required.
   */
  createCar: async (
    supabase: SupabaseClient, 
    carData: Omit<AppCar, "id" | "createdAt" | "updatedAt">,
    userId?: string | null // Pass userId explicitly
  ): Promise<AppCar> => {
    const dbPayload = transformAppCarToDbPayload({
      ...carData,
      features: carData.features ?? {},
      specifications: carData.specifications ?? {},
      imageUrls: carData.imageUrls ?? [],
    });

    const payloadWithCreator: Partial<CarDbRow> = {
      ...dbPayload,
      created_by: userId ?? undefined // Use passed userId
    };

    try {
      const { data, error } = await supabase
        .from("cars")
        .insert(payloadWithCreator as CarDbRow)
        .select<"*", CarDbRow>("*")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Failed to create car: No data returned.");
      return transformDbRowToAppCar(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(handleSupabaseError(error));
      }
      throw new Error("An unexpected error occurred creating car");
    }
  },

  /**
   * Update a car (Uses the provided client - likely Service Role)
   */
  updateCar: async (supabase: SupabaseClient, id: string, updates: Partial<AppCar>): Promise<AppCar> => {
    const dbPayload = transformAppCarToDbPayload(updates);
    if (Object.keys(dbPayload).length === 0) {
      // Call requires the client instance now
      const currentCar = await carServiceSupabase.getCarById(supabase, id); 
      if (!currentCar) throw new Error(`Car with ID ${id} not found for update.`);
      return currentCar;
    }
    try {
      const { data, error } = await supabase
        .from("cars")
        .update(dbPayload)
        .eq("id", id)
        .select<"*", CarDbRow>("*")
        .single();

      if (error) throw error;
      if (!data) throw new Error(`Failed to update car ${id}: No data returned.`);
      return transformDbRowToAppCar(data);
    } catch (error) {
       if (error instanceof Error) {
        throw new Error(handleSupabaseError(error));
      }
      throw new Error("An unexpected error occurred updating car");
    }
  },

  /**
   * Delete a car (Uses the provided client - likely Service Role)
   */
  deleteCar: async (supabase: SupabaseClient, id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("cars").delete().eq("id", id);
      if (error) throw error;
      return true;
    } catch (error) {
       if (error instanceof Error) {
        throw new Error(handleSupabaseError(error));
      }
      throw new Error("An unexpected error occurred deleting car");
    }
  },

  /**
   * Get unique categories (Respects client's RLS)
   */
  getCategories: async (supabase: SupabaseClient): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from("cars")
        .select("category")
        .eq("hidden", false);

      if (error) throw error;
      if (!data) return [];
      const categories = data.map((item) => item.category as string);
      return Array.from(new Set(categories.filter(Boolean))).sort();
    } catch (error) {
       if (error instanceof Error) {
        throw new Error(handleSupabaseError(error));
      }
      throw new Error("An unexpected error occurred fetching categories");
    }
  },

  /**
   * Get related cars (Respects client's RLS)
   */
  getRelatedCars: async (supabase: SupabaseClient, carId: string, limit = 3): Promise<AppCar[]> => {
    try {
      const { data: currentCar, error: carError } = await supabase
        .from("cars")
        .select("category")
        .eq("id", carId)
        .maybeSingle();

      if (carError) throw carError;
      if (!currentCar) return [];

      const { data: relatedCars, error: relatedError } = await supabase
        .from("cars")
        .select<"*", CarDbRow>("*")
        .eq("category", currentCar.category)
        .neq("id", carId)
        .eq("available", true)
        .eq("hidden", false)
        .limit(limit);

      if (relatedError) throw relatedError;
      if (!relatedCars) return [];
      return relatedCars.map(transformDbRowToAppCar);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(handleSupabaseError(error));
      }
      throw new Error("An unexpected error occurred fetching related cars");
    }
  },
}

