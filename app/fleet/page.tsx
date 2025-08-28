import type { Metadata } from 'next'
import type { Car as AppCar } from "@/lib/types/car"
import { ErrorBoundary } from "@/components/error-boundary"
import { Suspense } from "react"
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import FleetClientComponent from "./components/fleet-client-component"
import FleetLoading from "./loading"
import { createPageMetadata, KEYWORDS, SEO_CONFIG, generateDynamicDescription } from "@/lib/seo/metadata"

// Improve caching and revalidation
export const revalidate = 60; // Revalidate every 60 seconds

// Generate metadata for Fleet page
export async function generateMetadata(): Promise<Metadata> {
  const title = "Luxury & Exotic Car Fleet | Ferrari, Lamborghini, McLaren & More"
  const description = generateDynamicDescription(
    "Browse our extensive collection of over 50+ luxury and exotic cars available for rent",
    [
      "Ferrari, Lamborghini, McLaren, Porsche, Bentley, Rolls-Royce",
      "Latest models with professional maintenance",
      "Flexible rental periods & competitive pricing",
      "Instant availability checks & easy booking"
    ],
    "Washington DC, Maryland, and Virginia",
    "Find your perfect exotic car and book instantly with ExoDrive."
  )

  return createPageMetadata({
    title,
    description,
    keywords: [
      'exotic car fleet',
      'luxury car collection',
      'ferrari rental fleet',
      'lamborghini rental cars',
      'mclaren rental collection',
      'porsche rental fleet',
      'bentley rental cars',
      'rolls royce rental fleet',
      'exotic car availability',
      'luxury car selection',
      'supercar rental fleet',
      ...KEYWORDS.PRIMARY,
      ...KEYWORDS.SECONDARY.slice(0, 8),
      'car rental inventory',
      'luxury car variety',
      'exotic car brands',
      'premium car selection'
    ],
    canonical: `${SEO_CONFIG.BRAND.url}/fleet`,
    image: `${SEO_CONFIG.BRAND.url}/og-fleet.jpg`
  })
}

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
  // Adjust type hint to any[] for optimized structure
  let initialCars: any[] = []; 
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

    // Fetch using the correct service method
    const fetchCarsPromise = carServiceSupabase.getVisibleCarsForFleet(serviceClient);

    initialCars = await Promise.race([
      fetchCarsPromise,
      timeoutPromise
    ]) as any[]; // Use any[] type assertion

  } catch (err) {
    console.error("Error in FleetPage Server Fetch:", err);
    initialError = err instanceof Error ? err.message : "An unknown error occurred";
    // Use empty array as fallback, or update fallbackCars structure
    initialCars = []; // fallbackCars; 
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<FleetLoading />}>
        <FleetClientComponent 
          // Pass initialCars directly
          initialCars={initialCars}
          initialError={initialError}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

