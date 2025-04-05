import { notFound } from "next/navigation"
import { CarForm } from "@/components/car-form"
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export default async function EditCarPage({ params }: { params: { carId: string } }) {
  try {
    // Create the service role client
    const supabase = createSupabaseServiceRoleClient()
    
    // Fetch the car by slug using the service client
    const car = await carServiceSupabase.getCarBySlug(supabase, params.carId)

    if (!car) {
      console.error("Car not found with slug:", params.carId)
      notFound()
    }

    return <CarForm car={car} />
  } catch (error) {
    console.error("Error fetching car for edit:", error)
    notFound()
  }
}

