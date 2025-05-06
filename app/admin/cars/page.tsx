"use client" // Add 'use client' directive

import Link from "next/link"
import { useState, useEffect } from "react" // Import hooks
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Edit, Plus, Star, Archive, ArchiveRestore, Loader2, AlertTriangle } from "lucide-react" // Add Loader2 and AlertTriangle
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import { getSupabaseBrowserClient } from "@/lib/supabase/client" // Import browser client
import { getValidImageUrl } from "@/lib/utils/image-utils" // Removed handleImageError as ClientImage handles it
import { ClientImage } from "@/components/ui/client-image"
import { toggleCarVisibilityAction, fetchAllCarsForAdmin } from "@/app/admin/cars/actions"
import { Separator } from "@/components/ui/separator"
import type { OptimizedCarListItem, AppCar } from "@/lib/services/car-service-supabase"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js" // Import the correct type for payload
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert" // Import Alert components

// export default async function AdminCarsPage() { // Change to client component function
export default function AdminCarsPage() {
  // Add state for cars, loading, and error
  const [allCars, setAllCars] = useState<OptimizedCarListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient() // Get browser client instance for realtime updates
  
  // Fetch initial data using a standard API call pattern
  const fetchCars = async () => {
    try {
      setIsLoading(true);
      // Use standard fetch to call our API endpoint
      const response = await fetch('/api/admin/cars', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch cars');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch cars');
      }
      
      console.log(`Loaded ${data.cars.length} cars from API`);
      setAllCars(data.cars);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch cars:", err);
      setError(err.message || "Could not load cars");
      setAllCars([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch initial data and set up subscription
  useEffect(() => {
    fetchCars();
    
    // --- Supabase Realtime Subscription ---
    type CarPayload = { [key: string]: any } & { id: string }; // Simpler payload type focusing on ID

    // Helper to convert AppCar to OptimizedCarListItem
    const mapAppCarToOptimized = (appCar: AppCar | null): OptimizedCarListItem | null => {
      if (!appCar) return null;
      // Find primary image or fallback to first
      const primaryImage = appCar.images?.sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).find(img => img.is_primary) || appCar.images?.[0];
      
      console.log(`mapAppCarToOptimized for car ${appCar.id} (${appCar.name})`);
      console.log(`- appCar.hidden original value:`, appCar.hidden);
      console.log(`- appCar.hidden type:`, typeof appCar.hidden);
      
      const result = {
        id: appCar.id,
        slug: appCar.slug,
        name: appCar.name,
        category: appCar.category,
        available: appCar.available,
        featured: appCar.featured,
        hidden: appCar.hidden, // This should be a boolean
        created_at: appCar.createdAt ? new Date(appCar.createdAt).toISOString() : null,
        primary_image_url: primaryImage?.url ?? null,
        price_per_day: appCar.pricing?.base_price ?? null,
        shortDescription: appCar.short_description,
      };
      
      console.log(`- result.hidden mapped value:`, result.hidden);
      console.log(`- result.hidden type:`, typeof result.hidden);
      
      return result;
    };

    const handleChanges = async (payload: RealtimePostgresChangesPayload<CarPayload>) => {
      console.log('[Realtime] Change received!', payload);
      // Re-fetch all cars when data changes
      fetchCars();
    };

    const channel = supabase
      .channel('admin-cars-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cars' }, // Listen to all events
        (payload: RealtimePostgresChangesPayload<CarPayload>) => { handleChanges(payload); }
      )
      .subscribe()

    // Cleanup function
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // --- Add Console Logs for Debugging ---
  console.log("AdminCarsPage Render - All Cars:", allCars);
  
  // Add additional debugging logs
  const visibleCarsCount = allCars.filter(car => !car.hidden).length;
  const archivedCarsCount = allCars.filter(car => car.hidden === true).length;
  console.log(`AdminCarsPage Render - Stats: Total=${allCars.length}, Visible=${visibleCarsCount}, Archived=${archivedCarsCount}`);
  
  // Check individual hidden values
  allCars.forEach(car => {
    console.log(`Car ${car.name} (${car.id}): hidden=${car.hidden}, typeof hidden=${typeof car.hidden}`);
  });
  // --- End Console Logs ---

  // Loading State UI
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading cars...</span>
      </div>
    )
  }

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
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {allCars.length === 0 && !error && !isLoading && (
          <div className="p-4 text-center text-muted-foreground bg-secondary rounded-md">
            No cars found. Add one!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allCars.map((car) => {
            const imageUrl = getValidImageUrl(car.primary_image_url)
            const isArchived = car.hidden === true;

            return (
              <Card key={car.id} className={cn(
                "overflow-hidden transition-opacity",
                isArchived && "opacity-60 border-dashed border-muted-foreground"
              )}>
                <div className="relative h-48 bg-muted">
                  <ClientImage src={imageUrl} alt={car.name} fill className="object-cover" />
                  {car.featured && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black"><Star className="mr-1 h-3 w-3" />Featured</Badge>
                    </div>
                  )}
                  {isArchived && (
                    <div className="absolute top-2 right-2 z-10">
                      <Badge variant="secondary">Archived</Badge>
                    </div>
                  )}
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
                    <form action={toggleCarVisibilityAction} className="flex-1">
                      <input type="hidden" name="carId" value={car.id} />
                      <input type="hidden" name="isHidden" value={isArchived.toString()} />
                      <Button
                        type="submit"
                        variant={isArchived ? "secondary" : "outline"}
                        size="sm"
                        className="w-full"
                      >
                        {isArchived ? (
                          <>
                            <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
                          </>
                        ) : (
                          <>
                            <Archive className="mr-2 h-4 w-4" /> Archive
                          </>
                        )}
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}

