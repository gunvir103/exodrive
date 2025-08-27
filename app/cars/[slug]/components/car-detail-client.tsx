'use client'

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Share2, Heart, Calendar, Clock, Star } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { AppCar } from "@/lib/services/car-service-supabase"
import { CarImageGallery } from "@/components/car-detail/car-image-gallery"
import { CarOverview } from "@/components/car-detail/car-overview"
import { CarSpecifications } from "@/components/car-detail/car-specifications"
import { CarFeatures } from "@/components/car-detail/car-features"
import { CarReviews } from "@/components/car-detail/car-reviews"
import { CarCard } from "@/components/car-card"
import { useToast } from "@/hooks/use-toast"

interface CarDetailClientProps {
  car: AppCar;
  relatedCars: any[];
}

export function CarDetailClient({ car, relatedCars }: CarDetailClientProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [selectedPickupDate, setSelectedPickupDate] = useState<Date | null>(null);
  const [selectedDropoffDate, setSelectedDropoffDate] = useState<Date | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    import("@/lib/analytics/track-events").then(({ trackCarView }) => {
      trackCarView(
        car.id,
        car.name,
        car.pricing?.base_price ?? 0,
        car.category || "unknown"
      );
    });
  }, [car]);

  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setIsLoadingReviews(true);
        const response = await fetch(`/api/cars/${car.id}/reviews`);
        if (response.ok) {
          const data = await response.json();
          setReviews(data.reviews || []);
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setIsLoadingReviews(false);
      }
    };

    fetchReviews();
  }, [car.id]);

  const handleShare = useCallback(() => {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.exodrive.co';
    const shareUrl = `${baseUrl}${window.location.pathname}`;
    
    if (navigator.share) {
      navigator.share({
          title: `ExoDrive - ${car?.name}`,
          text: `Check out the ${car?.name} at ExoDrive!`,
          url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        toast({ title: "Link copied", description: "Car link copied to clipboard!" });
      }).catch(console.error);
    }
  }, [car?.name, toast]);

  const handleBookNow = useCallback(() => {
    // Store car selection in session storage for booking form
    if (typeof window !== 'undefined') {
      const bookingData = {
        carId: car.id,
        carName: car.name,
        carSlug: car.slug,
        pricePerDay: car.pricing?.base_price || 0,
        pickupDate: selectedPickupDate?.toISOString(),
        dropoffDate: selectedDropoffDate?.toISOString(),
      };
      
      sessionStorage.setItem('selectedCar', JSON.stringify(bookingData));
      
      // Track the booking intent
      import("@/lib/analytics/track-events").then(({ trackBookingIntent }) => {
        trackBookingIntent?.(car.id, car.name, car.pricing?.base_price || 0);
      });

      // Redirect to booking page
      router.push('/booking');
    }
  }, [car, selectedPickupDate, selectedDropoffDate, router]);

  const calculateTotalPrice = useCallback(() => {
    if (!selectedPickupDate || !selectedDropoffDate || !car.pricing?.base_price) {
      return null;
    }

    const days = Math.ceil(
      (selectedDropoffDate.getTime() - selectedPickupDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return Math.max(1, days) * car.pricing.base_price;
  }, [selectedPickupDate, selectedDropoffDate, car.pricing?.base_price]);

  const totalPrice = calculateTotalPrice();

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/cars" className="hover:text-foreground flex items-center">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Browse Cars
            </Link>
            <span>/</span>
            <span>{car.name}</span>
          </div>
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold md:text-4xl">{car.name}</h1>
                {car.featured && (
                  <Badge className="bg-rose-600 hover:bg-rose-700">
                    <Star className="mr-1 h-3 w-3" />
                    Featured
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-lg">{car.short_description}</p>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant="outline">{car.category}</Badge>
                <Badge variant={car.available ? "default" : "secondary"}>
                  {car.available ? "Available" : "Currently Booked"}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Price Display */}
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">
                  ${car.pricing?.base_price || 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">per day</div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsLiked(!isLiked)}
                        className={isLiked ? "text-red-500" : ""}
                      >
                        <Heart className={`h-5 w-5 ${isLiked ? "fill-red-500" : ""}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isLiked ? "Remove from favorites" : "Add to favorites"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={handleShare}>
                        <Share2 className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Share this car</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Image Gallery */}
          <div className="lg:col-span-2">
            <CarImageGallery images={car.images || []} carName={car.name} />
          </div>

          {/* Booking Card */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Book This Car
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Date Selection */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Pickup Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border rounded-md"
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setSelectedPickupDate(new Date(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Drop-off Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border rounded-md"
                      min={selectedPickupDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDropoffDate(new Date(e.target.value))}
                    />
                  </div>
                </div>

                {/* Price Summary */}
                {totalPrice && (
                  <div className="space-y-2 py-3 border-t">
                    <div className="flex justify-between text-sm">
                      <span>Daily rate:</span>
                      <span>${car.pricing?.base_price}/day</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Duration:</span>
                      <span>
                        {Math.max(1, Math.ceil(
                          (selectedDropoffDate!.getTime() - selectedPickupDate!.getTime()) / (1000 * 60 * 60 * 24)
                        ))} days
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>${totalPrice}</span>
                    </div>
                  </div>
                )}

                {/* Book Now Button */}
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleBookNow}
                  disabled={!car.available}
                >
                  {car.available ? "Book Now" : "Currently Unavailable"}
                </Button>

                {/* Additional Info */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center">
                    <Clock className="mr-1 h-3 w-3" />
                    Free cancellation up to 24 hours
                  </div>
                  <div className="flex items-center">
                    <Star className="mr-1 h-3 w-3" />
                    Premium insurance included
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="specs">Specifications</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <CarOverview car={car} />
              </TabsContent>

              <TabsContent value="specs">
                <CarSpecifications specifications={car.specifications || []} />
              </TabsContent>

              <TabsContent value="features">
                <CarFeatures features={car.features || []} />
              </TabsContent>

              <TabsContent value="reviews">
                <CarReviews reviews={reviews} isLoading={isLoadingReviews} /> 
              </TabsContent>
            </Tabs>
          </div>

          {/* Help Section */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Have questions about renting this {car.name}? Our team is ready to assist you.
                </p>
                <div className="space-y-3">
                  <Link href="/contact">
                    <Button className="w-full" variant="outline">
                      Contact Us
                    </Button>
                  </Link>
                  <Link href="/policies">
                    <Button variant="outline" className="w-full">
                      View Rental Policy
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Related Cars Section */}
        {relatedCars && relatedCars.length > 0 && (
          <div className="mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <h2 className="text-2xl font-bold mb-6">You might also like</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedCars.map((relatedCar, index) => (
                  <CarCard key={relatedCar.id} car={relatedCar} index={index} />
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}