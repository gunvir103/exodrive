import { notFound } from "next/navigation"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import { CarDetailClient } from "./components/car-detail-client"
import { Metadata, ResolvingMetadata } from 'next'
import { generateAppCarVehicleSchema, generateBreadcrumbSchema, safeJsonStringify, validateSchema, withCircuitBreaker } from '@/lib/seo/structured-data'

export const revalidate = 60; // Revalidate data every 60 seconds

interface CarDetailPageProps {
  params: { slug: string }
}

// Generate dynamic metadata for the car page
export async function generateMetadata(
  { params }: CarDetailPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const supabase = createSupabaseServiceRoleClient();
  
  try {
    // Fetch car data using the slug
    const car = await carServiceSupabase.getCarBySlug(supabase, params.slug);
    
    if (!car || car.hidden) {
      return {
        title: 'Car Not Found',
        description: 'The requested car could not be found.'
      }
    }

    // Get the primary image URL or fallback
    const primaryImage = car.images?.find(img => img.is_primary)?.url || car.images?.[0]?.url;
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.exodrive.co';
    const canonicalUrl = `${baseUrl}/cars/${params.slug}`;
    
    const priceText = car.pricing?.base_price ? ` - $${car.pricing.base_price}/day` : '';
    const title = `${car.name}${priceText} | Exo Drive`;
    const description = car.short_description || car.description || `Rent the ${car.name} - a luxury ${car.category} car available for hire.`;
    
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: primaryImage ? [
          {
            url: primaryImage,
            width: 1200,
            height: 630,
            alt: `${car.name} - Exo Drive Exotic Car Rentals`
          }
        ] : [],
        type: 'website',
        siteName: 'Exo Drive Exotic Car Rentals',
        url: canonicalUrl
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: primaryImage ? [primaryImage] : [],
      },
      alternates: {
        canonical: canonicalUrl
      }
    }
  } catch (error) {
    console.error("Error generating metadata for car:", params.slug, error);
    return {
      title: 'Car Details - Exo Drive',
      description: 'Explore our luxury and exotic car collection'
    }
  }
}

export default async function CarDetailPage({ params }: CarDetailPageProps) {
  const resolvedParams = await params; 
  const carSlug = resolvedParams.slug;
  
  if (!carSlug) {
    console.error("carSlug param is missing.");
    notFound();
  }

  const supabase = createSupabaseServiceRoleClient();

  try {
    // Fetch car data using the slug
    const car = await carServiceSupabase.getCarBySlug(supabase, carSlug);

    if (!car) {
      console.error(`Car not found with slug: ${carSlug}`);
      notFound();
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

    // Generate structured data for the car with enhanced error handling and circuit breaker
    const safeVehicleSchemaGenerator = withCircuitBreaker(
      generateAppCarVehicleSchema,
      `vehicle-schema-${carSlug}`,
      null
    );
    
    const safeBreadcrumbSchemaGenerator = withCircuitBreaker(
      generateBreadcrumbSchema,
      `breadcrumb-schema-${carSlug}`,
      null
    );
    
    let vehicleSchema = null;
    let breadcrumbSchema = null;
    let schemaJson = '';
    
    try {
      vehicleSchema = safeVehicleSchemaGenerator(car, carSlug);
      if (vehicleSchema && !validateSchema(vehicleSchema)) {
        console.warn(`Vehicle schema for ${carSlug} failed validation`);
        vehicleSchema = null;
      }
    } catch (error) {
      console.error(`Failed to generate vehicle schema for ${carSlug}:`, error);
      vehicleSchema = null;
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.exodrive.co';

    try {
      breadcrumbSchema = safeBreadcrumbSchemaGenerator([
        { name: 'Home', url: baseUrl },
        { name: 'Cars', url: `${baseUrl}/cars` },
        { name: car.name, url: `${baseUrl}/cars/${carSlug}` },
      ]);
      if (breadcrumbSchema && !validateSchema(breadcrumbSchema)) {
        console.warn(`Breadcrumb schema for ${carSlug} failed validation`);
        breadcrumbSchema = null;
      }
    } catch (error) {
      console.error(`Failed to generate breadcrumb schema for ${carSlug}:`, error);
      breadcrumbSchema = null;
    }

    // Combine valid schemas only and safely generate JSON
    const validSchemas = [vehicleSchema, breadcrumbSchema].filter(Boolean);
    
    if (validSchemas.length > 0) {
      try {
        const schemaData = validSchemas.length === 1 ? validSchemas[0] : validSchemas;
        schemaJson = safeJsonStringify(schemaData);
        
        // Final validation
        if (!schemaJson || schemaJson === '{}') {
          console.warn(`Generated schema JSON for ${carSlug} is empty or invalid`);
          schemaJson = '';
        }
      } catch (error) {
        console.error(`Failed to generate schema JSON for ${carSlug}:`, error);
        schemaJson = '';
      }
    }

    // Render the Client Component with structured data
    return (
      <>
        {schemaJson && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: schemaJson,
            }}
          />
        )}
        <CarDetailClient car={car} relatedCars={relatedCars} />
      </>
    );

  } catch (error) {
    console.error("Error fetching car detail page data for slug:", carSlug, error);
    notFound();
  }
}