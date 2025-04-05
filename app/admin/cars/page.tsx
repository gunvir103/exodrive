import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Edit, Plus, Star, Trash } from "lucide-react"
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { getValidImageUrl, handleImageError } from "@/lib/utils/image-utils"
import { ClientImage } from "@/components/ui/client-image"
import type { Car as AppCar } from "@/lib/types/car"

// Server Component: Fetches all cars using service role client
export default async function AdminCarsPage() {
  let cars: AppCar[] = []
  let error: string | null = null

  try {
    const supabase = createSupabaseServiceRoleClient()
    // Fetch *all* cars for admin view, including hidden ones
    // Using Service Client bypasses RLS
    cars = await carServiceSupabase.getAllCars(supabase)
  } catch (err: any) {
    console.error("Admin Failed to fetch cars:", err)
    error = err.message || "Could not load cars"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Cars</h1>
        <Button asChild>
          <Link href="/admin/cars/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Car
          </Link>
        </Button>
      </div>

      {error && (
        <div className="p-4 text-center text-red-600 bg-red-100 rounded-md">
          Error loading cars: {error}
        </div>
      )}

      {cars.length === 0 && !error && (
        <div className="p-4 text-center text-muted-foreground bg-secondary rounded-md">
          No cars found in the database. Add one!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cars.map((car) => {
          const imageUrl = getValidImageUrl(car.imageUrls?.[0])
          return (
            <Card key={car.id} className={`overflow-hidden ${car.isHidden ? "opacity-60 border-dashed border-muted-foreground" : ""}`}>
              <div className="relative h-48 bg-muted">
                <ClientImage
                  src={imageUrl}
                  alt={car.name}
                  fill
                  className="object-cover"
                />
                {car.isFeatured && (
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">
                      <Star className="mr-1 h-3 w-3" />
                      Featured
                    </Badge>
                  </div>
                )}
                {car.isHidden && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary">Hidden</Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold truncate" title={car.name}>{car.name}</h3>
                  <span className="font-medium whitespace-nowrap">${car.pricePerDay}/day</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline">{car.category}</Badge>
                  <Badge variant={car.isAvailable ? "default" : "secondary"}>
                    {car.isAvailable ? "Available" : "Unavailable"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/admin/cars/${car.slug}`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="destructive" size="sm" disabled>
                    <Trash className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

