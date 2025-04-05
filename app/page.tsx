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

// Remove client-side function definitions (CountUp, HomeClientComponent)
// function CountUp(...) { ... }
// interface HomeClientComponentProps { ... }
// function HomeClientComponent(...) { ... }

// --- Server Component Wrapper --- 

import { carServiceSupabase } from "@/lib/services/car-service-supabase";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Default export: The Server Component that fetches data
export default async function HomePage() {
  // --- Restore SERVER FETCHING ---
  let initialCars: AppCar[] = [];
  let initialError: string | null = null;
  try {
    console.log("Attempting to create service client..."); // Debug log
    const serviceClient = createSupabaseServiceRoleClient();
    console.log("Service client created, attempting to fetch cars..."); // Debug log
    initialCars = await carServiceSupabase.getVisibleCars(serviceClient);
    console.log(`Fetched ${initialCars.length} cars successfully.`); // Debug log
  } catch (err) { // Catch any error type
    console.error("***** ERROR in HomePage Server Fetch *****:", err); // Log the raw error
    initialError = (err instanceof Error) ? err.message : "An unknown error occurred during server fetch";
  }
  // --- END Restore SERVER FETCHING ---

  // Render the client component, passing the fetched data as props
  return (
    <HomeClientComponent 
      initialCars={initialCars} 
      initialError={initialError} 
    />
  );
}


