import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Edit, Plus, Star, Archive, ArchiveRestore } from "lucide-react"
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { getValidImageUrl, handleImageError } from "@/lib/utils/image-utils"
import { ClientImage } from "@/components/ui/client-image"
import { toggleCarVisibilityAction } from "@/app/admin/cars/actions"
import { Separator } from "@/components/ui/separator"
import type { OptimizedCarListItem } from "@/lib/services/car-service-supabase"

// Server Component: Fetches all cars using service role client
export default async function AdminCarsPage() {
  let allCars: OptimizedCarListItem[] = []
  let error: string | null = null

  try {
    const supabase = createSupabaseServiceRoleClient()
    allCars = await carServiceSupabase.getAllCarsForAdminList(supabase)
  } catch (err: any) {
    console.error("Admin Failed to fetch cars:", err)
    error = err.message || "Could not load cars"
  }

  // Separate visible and archived cars
  const visibleCars = allCars.filter(car => !car.hidden);
  const archivedCars = allCars.filter(car => car.hidden);

  return (
    <div className="space-y-8"> {/* Increased spacing */}
      {/* Section for Visible Cars */}
      <section>
        <div className="flex items-center justify-between mb-4">
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

        {visibleCars.length === 0 && !error && (
          <div className="p-4 text-center text-muted-foreground bg-secondary rounded-md">
            No visible cars found. Add one or unarchive existing cars.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleCars.map((car) => {
            const imageUrl = getValidImageUrl(car.primary_image_url)
            // No need for isHidden check here as we filtered already
            return (
              <Card key={car.id} className="overflow-hidden">
                <div className="relative h-48 bg-muted">
                  <ClientImage src={imageUrl} alt={car.name} fill className="object-cover" />
                  {car.featured && (
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black"><Star className="mr-1 h-3 w-3" />Featured</Badge>
                    </div>
                  )}
                  {/* Removed Hidden badge display for visible cars */}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold truncate" title={car.name}>{car.name}</h3>
                    <span className="font-medium whitespace-nowrap">${car.price_per_day ?? 'N/A'}/day</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="outline">{car.category}</Badge>
                    <Badge variant={car.available ? "default" : "secondary"}>
                      {car.available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/admin/cars/${car.slug}`}><Edit className="mr-2 h-4 w-4" />Edit</Link>
                    </Button>
                    {/* Archive/Unarchive Button Form */}
                    <form action={toggleCarVisibilityAction} className="flex-1">
                      <input type="hidden" name="carId" value={car.id} />
                      <input type="hidden" name="isHidden" value={false.toString()} />
                      <Button type="submit" variant="outline" size="sm" className="w-full">
                        <Archive className="mr-2 h-4 w-4" /> Archive
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Separator and Section for Archived Cars */}
      {archivedCars.length > 0 && (
        <>
          <Separator className="my-8" /> 
          <section>
            <h2 className="text-xl font-bold mb-4">Archived Cars</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {archivedCars.map((car) => {
                 const imageUrl = getValidImageUrl(car.primary_image_url)
                 return (
                  <Card key={car.id} className="overflow-hidden opacity-60 border-dashed border-muted-foreground">
                    <div className="relative h-48 bg-muted">
                      <ClientImage src={imageUrl} alt={car.name} fill className="object-cover" />
                      {car.featured && (
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black"><Star className="mr-1 h-3 w-3" />Featured</Badge>
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                          <Badge variant="secondary">Archived</Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold truncate" title={car.name}>{car.name}</h3>
                        <span className="font-medium whitespace-nowrap">${car.price_per_day ?? 'N/A'}/day</span>
                      </div>
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant="outline">{car.category}</Badge>
                        <Badge variant={car.available ? "default" : "secondary"}>
                          {car.available ? "Available" : "Unavailable"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link href={`/admin/cars/${car.slug}`}><Edit className="mr-2 h-4 w-4" />Edit</Link>
                        </Button>
                        {/* Unarchive Button Form */}
                        <form action={toggleCarVisibilityAction} className="flex-1">
                          <input type="hidden" name="carId" value={car.id} />
                          <input type="hidden" name="isHidden" value={true.toString()} />
                          <Button type="submit" variant="secondary" size="sm" className="w-full">
                            <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
                          </Button>
                        </form>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

