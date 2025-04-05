import { notFound } from "next/navigation"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server" // Use server client for server component
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import { CarDetailClient } from "@/components/car-detail/car-detail-client"
import { Metadata, ResolvingMetadata } from 'next'

// This is now a Server Component - remove "use client"

// Optional: Configure revalidation
export const revalidate = 60; // Revalidate data every 60 seconds

interface CarDetailPageProps {
  params: { carSlug: string }; // Renamed param
}

// Generate dynamic metadata for the car page
export async function generateMetadata(
  { params }: CarDetailPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  // Get Supabase service client
  const supabase = createSupabaseServiceRoleClient();
  
  try {
    // Fetch car data using the slug
    const car = await carServiceSupabase.getCarBySlug(supabase, params.carSlug);
    
    if (!car || car.hidden) {
      return {
        title: 'Car Not Found',
        description: 'The requested car could not be found.'
      }
    }

    // Get the primary image URL or fallback
    const primaryImage = car.images?.find(img => img.is_primary)?.url || car.images?.[0]?.url;
    
    // Construct base metadata
    const metadata: Metadata = {
      title: car.name,
      description: car.short_description || car.description,
      openGraph: {
        title: car.name,
        description: car.short_description || car.description,
        images: primaryImage ? [
          {
            url: primaryImage,
            width: 1200,
            height: 630,
            alt: `${car.name} - Exo Drive Exotic Car Rentals`
          }
        ] : [],
        type: 'website',
        siteName: 'Exo Drive Exotic Car Rentals'
      },
      twitter: {
        card: 'summary_large_image',
        title: car.name,
        description: car.short_description || car.description,
        images: primaryImage ? [primaryImage] : [],
      }
    }

    return metadata;
  } catch (error) {
    console.error("Error generating metadata for car:", params.carSlug, error);
    return {
      title: 'Car Details - Exo Drive',
      description: 'Explore our luxury and exotic car collection'
    }
  }
}

export default async function CarDetailPage({ params }: CarDetailPageProps) {
    // Ensure params object is resolved before accessing
    const resolvedParams = await params; 
    const carSlug = resolvedParams.carSlug;
    
    if (!carSlug) {
      console.error("carSlug param is missing.");
      notFound();
    }

    // Get Supabase service client
    const supabase = createSupabaseServiceRoleClient();

    try {
        // Fetch car data using the slug
        const car = await carServiceSupabase.getCarBySlug(supabase, carSlug);

        if (!car) {
            console.error(`Car not found with slug: ${carSlug}`);
            notFound(); // Trigger 404 if car doesn't exist
        }

        // Trigger 404 if the car is marked as hidden
        if (car.hidden) {
            console.log(`Attempted to access hidden car: ${carSlug}`);
            notFound(); 
        }

        // Fetch related cars (using the fetched car's ID)
        const relatedCars = car?.id 
            ? await carServiceSupabase.getRelatedCars(supabase, car.id, 3)
            : [];

        // Render the Client Component, passing fetched data as props
        return <CarDetailClient car={car} relatedCars={relatedCars} />;

    } catch (error) {
        console.error("Error fetching car detail page data for slug:", carSlug, error);
        notFound();
    }
}

// Keep Loading component (if it exists and is needed)
// export function Loading() { ... }

