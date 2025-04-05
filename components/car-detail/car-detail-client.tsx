'use client'

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Share2, Heart, Loader2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { AppCar } from "@/lib/services/car-service-supabase" // Use the correct service type
import { CarImageGallery } from "@/components/car-detail/car-image-gallery"
import { CarOverview } from "@/components/car-detail/car-overview"
import { CarSpecifications } from "@/components/car-detail/car-specifications"
import { CarFeatures } from "@/components/car-detail/car-features"
import { CarReviews } from "@/components/car-detail/car-reviews" // Assuming this exists
import { CarBookingForm } from "@/components/car-detail/car-booking-form" // Assuming this exists
import { CarCard } from "@/components/car-card"
import { useToast } from "@/hooks/use-toast"

interface CarDetailClientProps {
  car: AppCar;
  relatedCars: any[]; // Use any for now, define specific type if needed
}

// Extracting the client component logic
export function CarDetailClient({ car, relatedCars }: CarDetailClientProps) {
  const [isLiked, setIsLiked] = useState(false); // Like state is client-side
  const router = useRouter();
  const { toast } = useToast();

  // Add state for components that might need client-side fetching or interaction later
  // E.g., Reviews, Availability calendar within BookingForm

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
          title: `exoDrive - ${car?.name}`,
          text: `Check out the ${car?.name} at exoDrive!`,
          url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        toast({ title: "Link copied", description: "Car link copied to clipboard!" });
      }).catch(console.error);
    }
  }, [car?.name, toast]);

  // Removed the initial loading state and useEffect fetch as data is passed via props

  return (
    <div className="container py-6 md:py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/fleet" className="hover:text-foreground flex items-center">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Our Fleet
          </Link>
          <span>/</span>
          <span>{car.name}</span>
        </div>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">{car.name}</h1>
            {/* Use short_description from AppCar */}
            <p className="text-muted-foreground mt-1">{car.short_description}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Display price from pricing object */}
            <div className="text-2xl font-bold">${car.pricing?.base_price ?? 'N/A'}/day</div>
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
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Image Gallery */}
        <div className="md:col-span-2">
          {/* Pass images array (guaranteed to be array by service) and name */}
          <CarImageGallery images={car.images || []} carName={car.name} />
        </div>

        {/* Booking Form Sticky Section */}
        <div>
           <div className="bg-card rounded-lg border shadow-sm p-6 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
             <h2 className="text-xl font-bold mb-4">Book This Car</h2>
             {/* Check if pricing exists before rendering booking form */}
             {car.pricing ? (
               <CarBookingForm carId={car.id} pricing={car.pricing} availability={undefined} />
             ) : (
               <p className="text-sm text-muted-foreground">Booking information unavailable.</p>
             )}
           </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
        <div className="md:col-span-2">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="specs">Specifications</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              {/* Pass the whole car object (already checked for null) */}
              <CarOverview car={car} />
            </TabsContent>

            <TabsContent value="specs">
               {/* Pass specifications array (guaranteed by service) */}
               <CarSpecifications specifications={car.specifications || []} />
            </TabsContent>

            <TabsContent value="features">
              {/* Pass features array (guaranteed by service) */}
              <CarFeatures features={car.features || []} />
            </TabsContent>

            <TabsContent value="reviews">
              {/* Pass empty array for reviews */}
               <CarReviews reviews={[]} /> 
            </TabsContent>
          </Tabs>
        </div>

         {/* Help Section (Static or dynamic) */}
         <div className="hidden md:block">
           <motion.div
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ duration: 0.5, delay: 0.3 }}
           >
             <div className="bg-card rounded-lg border shadow-sm p-6 sticky top-20">
               <h3 className="text-xl font-bold mb-4">Need Help?</h3>
               <p className="text-muted-foreground mb-4 text-sm">
                 Have questions about renting this {car.name}? Our team is ready to assist you.
               </p>
               <div className="space-y-4">
                 {/* TODO: Update button actions/links */}
                 <Button className="w-full bg-white text-black hover:bg-gray-100">Contact Us</Button>
                 <Button variant="outline" className="w-full">
                   View Rental Policy
                 </Button>
               </div>
             </div>
           </motion.div>
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
  );
} 