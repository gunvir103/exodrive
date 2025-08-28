import type { AppCar } from "@/lib/services/car-service-supabase";
import HomeClientComponent from "@/app/(main)/components/home-client-component"
import { ErrorBoundary } from "@/components/error-boundary"
import { Suspense } from "react" 

import { carServiceSupabase } from "@/lib/services/car-service-supabase";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";


// Default export: The Server Component that fetches data
export default async function HomePage() {
  // --- Restore SERVER FETCHING ---
  let initialCars: any[] = []; // Use any[] as the return type of getVisibleCarsForFleet is optimized
  let initialError: string | null = null;
  let featuredCarId: string | null = null;
  let featuredCarData: AppCar | null = null; // Add state for full featured car data
  
  try {
    // Create service client for fetching cars
    const serviceClient = createSupabaseServiceRoleClient();
    
    if (!serviceClient) {
      throw new Error("Failed to create Supabase client");
    }
    
    // Fetch optimized fleet data
    // Use the correct, refactored service method for optimized fleet data
    initialCars = await carServiceSupabase.getVisibleCarsForFleet(serviceClient); 
    // Cars fetched successfully
    
    // Check if there's a featured car in homepage settings
    try {
      // First check if the table exists
      const { error: tableError } = await serviceClient
        .from('homepage_settings')
        .select('*', { count: 'exact', head: true });

      if (tableError && tableError.code === '42P01') {
        // Homepage settings table not found
      } else {
        // Table exists, fetch the settings
        const { data: homepageSettings, error } = await serviceClient
          .from('homepage_settings')
          .select('featured_car_id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          // Error fetching homepage settings
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
            } catch (featuredCarErr) {
              // Error fetching full data for featured car
              // featuredCarData will remain null
            }
          }
          // --- END Fetch FULL featured car data ---
        }
      }
    } catch (settingsErr) {
      // Error handling homepage settings
    }
    
    // If no featured car was set from settings, use the first car
    if (!initialCars.some(car => car.isFeatured) && initialCars.length > 0) {
      initialCars[0].isFeatured = true;
    }
    
  } catch (err) {
    initialError = (err instanceof Error) ? err.message : "An unknown error occurred during server fetch";
    initialCars = [];
  }
  // --- END Restore SERVER FETCHING ---

  // Render the client component, passing the fetched data as props
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="h-screen w-full bg-black flex items-center justify-center text-white">Loading...</div>}>
        <HomeClientComponent 
          initialCars={initialCars} 
          initialError={initialError} 
          featuredCar={featuredCarData}
        />
      </Suspense>
    </ErrorBoundary>
  );
}


