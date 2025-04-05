import { notFound } from "next/navigation"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server" // Use server client for server component
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import { CarDetailClient } from "@/components/car-detail/car-detail-client"

// This is now a Server Component - remove "use client"

// Optional: Configure revalidation
export const revalidate = 60; // Revalidate data every 60 seconds

interface CarDetailPageProps {
  params: { carSlug: string }; // Renamed param
}

export default async function CarDetailPage({ params }: CarDetailPageProps) {
    // Get Supabase service client
    const supabase = createSupabaseServiceRoleClient();

    try {
        // Fetch car data using the slug
        const car = await carServiceSupabase.getCarBySlug(supabase, params.carSlug);

        if (!car) {
            console.error(`Car not found with slug: ${params.carSlug}`);
            notFound(); // Trigger 404 if car doesn't exist
        }

        // Trigger 404 if the car is marked as hidden
        if (car.hidden) {
            console.log(`Attempted to access hidden car: ${params.carSlug}`);
            notFound(); 
        }

        // Fetch related cars (using the fetched car's ID)
        const relatedCars = car?.id 
            ? await carServiceSupabase.getRelatedCars(supabase, car.id, 3)
            : [];

        // Render the Client Component, passing fetched data as props
        return <CarDetailClient car={car} relatedCars={relatedCars} />;

    } catch (error) {
        console.error("Error fetching car detail page data:", error);
        // Handle error gracefully - maybe show a generic error page or message
        // For now, just re-throw or call notFound()
        notFound(); // Or throw new Error("Failed to load car details");
    }
}

// Keep Loading component (if it exists and is needed)
// export function Loading() { ... }

