import { notFound } from "next/navigation"
import { CarForm } from "@/components/car-form"
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

// Access params directly first, then get the slug
export default async function EditCarPage({ params }: { params: { carSlug: string } }) {
  const carSlug = params.carSlug; // Access slug *after* function signature
  
  if (!carSlug) {
    console.error("carSlug param is missing.");
    notFound();
  }

  try {
    // Create the service role client
    const supabase = createSupabaseServiceRoleClient()
    
    // Fetch the car by slug using the extracted variable
    const car = await carServiceSupabase.getCarBySlug(supabase, carSlug)

    if (!car) {
      console.error("Car not found with slug:", carSlug)
      notFound()
    }

    // Pass the fetched car (which includes related data) to the form
    return <CarForm car={car} />
  } catch (error) {
    console.error("Error fetching car for edit page with slug:", carSlug, error);
    notFound()
  }
}

