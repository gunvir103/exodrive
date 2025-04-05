import type { Car as AppCar } from "@/lib/types/car"
import { ErrorBoundary } from "@/components/error-boundary"
import { Suspense } from "react"
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import FleetClientComponent from "./components/fleet-client-component"
import FleetLoading from "./loading"

// Improve caching and revalidation
export const revalidate = 60; // Revalidate every 60 seconds

// Fallback car data in case of error
const fallbackCars: AppCar[] = [
  {
    id: "fallback-1",
    slug: "fallback-luxury-car",
    name: "Luxury Car",
    category: "luxury",
    description: "A premium luxury vehicle for your journey.",
    shortDescription: "Premium luxury vehicle",
    pricePerDay: 899.99,
    imageUrls: ["/placeholder.svg?text=Luxury+Car"],
    isAvailable: true,
    isFeatured: true,
    isHidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

// Default export: The Server Component that fetches data
export default async function FleetPage() {
  let initialCars: AppCar[] = [];
  let initialError: string | null = null;

  try {
    const serviceClient = createSupabaseServiceRoleClient();
    
    if (!serviceClient) {
      throw new Error("Failed to create Supabase client");
    }
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Data fetch timeout")), 5000);
    });

    initialCars = await Promise.race([
      carServiceSupabase.getVisibleCars(serviceClient),
      timeoutPromise
    ]) as AppCar[];

  } catch (err) {
    console.error("Error in FleetPage Server Fetch:", err);
    initialError = err instanceof Error ? err.message : "An unknown error occurred";
    initialCars = fallbackCars;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<FleetLoading />}>
        <FleetClientComponent 
          initialCars={initialCars.length > 0 ? initialCars : fallbackCars}
          initialError={initialError}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

