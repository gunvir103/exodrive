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
import type { Car as AppCar } from "@/lib/types/car"
// import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"
// import Autoplay from "embla-carousel-autoplay"
// import { HeroSection } from "@/components/hero-section"
// import { Skeleton } from "@/components/ui/skeleton"
// import { getValidImageUrl, handleImageError } from "@/lib/utils/image-utils"

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
export default async function HomePage() {
  // --- Restore SERVER FETCHING ---
  let initialCars: any[] = []; // Use any[] as the return type of getVisibleCarsForFleet is optimized
  let initialError: string | null = null;
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
      const { data: homepageSettings, error } = await serviceClient
        .from('homepage_settings')
        .select('*')
        .maybeSingle();
      
      // If table doesn't exist yet, just continue without error
      if (error && error.code === 'PGRST301') {
        console.warn('Homepage settings table not found. Run migrations first.');
      } else if (error) {
        console.error('Error fetching homepage settings:', error);
      } else if (homepageSettings?.featured_car_id) {
        // Find the corresponding car in the already fetched cars
        const featuredCarIndex = initialCars.findIndex(car => car.id === homepageSettings.featured_car_id);
        
        if (featuredCarIndex >= 0) {
          // Mark the car as featured for the UI
          initialCars[featuredCarIndex].isFeatured = true;
          
          // Remove featured flag from any other cars
          initialCars.forEach((car, index) => {
            if (index !== featuredCarIndex) {
              car.isFeatured = false;
            }
          });
        }
      } else {
        // If no specific car is marked as featured, show first car as featured
        if (initialCars.length > 0) {
          initialCars[0].isFeatured = true;
        }
      }
    } catch (settingsErr) {
      console.error("Error handling homepage settings:", settingsErr);
      // If we can't access settings, default to showing first car as featured
      if (initialCars.length > 0) {
        initialCars[0].isFeatured = true;
      }
    }
    
  } catch (err) { // Catch any error type
    console.error("***** ERROR in HomePage Server Fetch *****:", err); // Log the raw error
    initialError = (err instanceof Error) ? err.message : "An unknown error occurred during server fetch";
    // Use fallback data - Adjust fallback if needed for the new structure
    // initialCars = fallbackCars; // Commenting out fallback for now, needs update
    initialCars = []; // Default to empty array on error
  }
  // --- END Restore SERVER FETCHING ---

  // Render the client component, passing the fetched data as props
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="h-screen w-full bg-black flex items-center justify-center text-white">Loading...</div>}>
        <HomeClientComponent 
          initialCars={initialCars} 
          initialError={initialError} 
        />
      </Suspense>
    </ErrorBoundary>
  );
}


