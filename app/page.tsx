// Remove "use client" directive from the top

// Remove client-side imports
// import { useEffect, useState, useRef, Suspense } from "react"
// import Image from "next/image"
// import Link from "next/link"
// import { motion, useInView } from "framer-motion"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { CheckCircle, Shield, Car, Star, Zap, MapPin, Instagram } from "lucide-react"
// import { CarCard } from "@/components/car-card"
// Remove potentially conflicting import
// import type { Car as AppCar } from "@/lib/types/car"
// import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"
// import Autoplay from "embla-carousel-autoplay"
// import { HeroSection } from "@/components/hero-section"
// import { Skeleton } from "@/components/ui/skeleton"
// import { getValidImageUrl, handleImageError } from "@/lib/utils/image-utils"
import type { AppCar } from "@/lib/services/car-service-supabase"; // Keep this import

// Import the NEW client component
import HomeClientComponent from "@/app/(main)/components/home-client-component"
import { ErrorBoundary } from "@/components/error-boundary"
import { Suspense } from "react"

// Remove client-side function definitions (CountUp, HomeClientComponent)
// function CountUp(...) { ... }
// interface HomeClientComponentProps { ... }
// function HomeClientComponent(...) { ... }

// --- Server Component Wrapper --- 

import { carServiceSupabase } from "@/lib/services/car-service-supabase";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { generateOrganizationJsonLd } from '@/lib/structured-data';

export const revalidate = 60; // Revalidate every 60 seconds

// Fallback car data in case of error
const fallbackCars: AppCar[] = [
  {
    id: "fallback-1",
    slug: "fallback-luxury-car",
    name: "Luxury Car",
    category: "luxury",
    description: "A premium luxury vehicle for your journey.",
    short_description: "Premium luxury vehicle", // Use snake_case for Supabase fields
    // Ensure pricing matches CarPricing structure or is null
    pricing: {
      // Adjust fallback pricing to match actual CarPricing schema
      id: "fallback-pricing", 
      car_id: "fallback-1", 
      base_price: 899.99,
      created_at: new Date().toISOString(), 
      updated_at: new Date().toISOString(), 
      deposit_amount: 500, // Example deposit
      // Remove fields not in schema
      // cost_per_mile: 0,
      // included_miles: 0,
      // weekly_discount: 0,
      // monthly_discount: 0,
      // Add fields from schema based on linter error
      currency: "USD", // Add required currency
      discount_percentage: null, // Nullable
      minimum_days: 1, // Example minimum days
      special_offer_text: null, // Nullable
    },
    // Use car_images structure
    images: [
      {
        id: "fallback-image-1", // Dummy ID
        car_id: "fallback-1", // Link to car
        url: "/placeholder.svg?text=Luxury+Car",
        alt: "Fallback luxury car", // Use 'alt' instead of 'alt_text'
        is_primary: true,
        sort_order: 0,
        path: null, // Add path if needed, or keep null
        created_at: new Date().toISOString(), // Convert Date to string
      },
    ],
    // Use car_features structure
    features: [],
    // Use car_specifications structure
    specifications: [],
    available: true, // Use snake_case based on AppCar/CarBase
    featured: true,
    hidden: false,
    createdAt: new Date().toISOString(), // Convert Date to string
    updatedAt: new Date().toISOString(), // Convert Date to string
  },
];

// Default export: The Server Component that fetches data
export default async function HomePage() {
  // --- Restore SERVER FETCHING ---
  let initialCars: any[] = []; // Use any[] as the return type of getVisibleCarsForFleet is optimized
  let initialError: string | null = null;
  let featuredCarId: string | null = null;
  let featuredCarData: AppCar | null = null; // Add state for full featured car data
  
  try {
    console.log("Attempting to create service client..."); // Debug log
    const serviceClient = createSupabaseServiceRoleClient();
    
    if (!serviceClient) {
      throw new Error("Failed to create Supabase client");
    }
    
    console.log("Service client created, attempting to fetch cars..."); // Debug log
    // Use the correct, refactored service method for optimized fleet data
    initialCars = await carServiceSupabase.getVisibleCarsForFleet(serviceClient); 
    console.log(`Fetched ${initialCars.length} cars successfully.`); // Debug log
    
    // Check if there's a featured car in homepage settings
    try {
      // First check if the table exists
      const { error: tableError } = await serviceClient
        .from('homepage_settings')
        .select('*', { count: 'exact', head: true });

      if (tableError && tableError.code === '42P01') {
        console.warn('Homepage settings table not found. Run migrations first.');
      } else {
        // Table exists, fetch the settings
        const { data: homepageSettings, error } = await serviceClient
          .from('homepage_settings')
          .select('featured_car_id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error('Error fetching homepage settings:', error);
        } else if (homepageSettings?.featured_car_id) {
          featuredCarId = homepageSettings.featured_car_id;
          
          // Mark the selected car as featured in our data (for carousel highlighting)
          initialCars.forEach(car => {
            car.isFeatured = car.id === featuredCarId;
          });
          
          // --- Fetch FULL featured car data ---
          // Add null check for featuredCarId before fetching
          if (featuredCarId) { 
            try {
              featuredCarData = await carServiceSupabase.getCarById(serviceClient, featuredCarId);
              console.log(`Fetched full data for featured car ID: ${featuredCarId}`);
              // ---- ADD DETAILED LOG ----
              console.log("Server Fetched Featured Car Data:", JSON.stringify(featuredCarData, null, 2));
              // ---- END DETAILED LOG ----
            } catch (featuredCarErr) {
              console.error(`Error fetching full data for featured car ${featuredCarId}:`, featuredCarErr);
              // ---- ADD ERROR LOG ----
              console.log("Featured Car Data on Error:", JSON.stringify(featuredCarData, null, 2)); // Log data even if error occurred after assignment
              // ---- END ERROR LOG ----
              // Optionally handle this error, maybe fallback or log more details
              // For now, featuredCarData will remain null
            }
          } else {
            console.log("No featuredCarId found in settings, cannot fetch full data.");
          }
          // --- END Fetch FULL featured car data ---
          
          console.log(`Featured car ID set to: ${featuredCarId}`); // Updated log
        }
      }
    } catch (settingsErr) {
      console.error("Error handling homepage settings:", settingsErr);
    }
    
    // If no featured car was set from settings, use the first car
    if (!initialCars.some(car => car.isFeatured) && initialCars.length > 0) {
      initialCars[0].isFeatured = true;
      console.log(`No featured car found in settings, defaulting to first car: ${initialCars[0].id}`);
    }
    
  } catch (err) { // Catch any error type
    console.error("***** ERROR in HomePage Server Fetch *****:", err); // Log the raw error
    initialError = (err instanceof Error) ? err.message : "An unknown error occurred during server fetch";
    initialCars = []; // Default to empty array on error
  }
  // --- END Restore SERVER FETCHING ---

  // Render the client component, passing the fetched data as props
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ 
          __html: JSON.stringify(generateOrganizationJsonLd()) 
        }}
      />
      <ErrorBoundary>
        <Suspense fallback={<div className="h-screen w-full bg-black flex items-center justify-center text-white">Loading...</div>}>
          <HomeClientComponent 
            initialCars={initialCars} 
            initialError={initialError} 
            featuredCar={featuredCarData}
          />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}


