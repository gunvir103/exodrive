"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Share2, Heart } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CarService } from "@/lib/services/car-service"
import type { Car } from "@/lib/types/car"
import { CarImageGallery } from "@/components/car-detail/car-image-gallery"
import { CarOverview } from "@/components/car-detail/car-overview"
import { CarSpecifications } from "@/components/car-detail/car-specifications"
import { CarFeatures } from "@/components/car-detail/car-features"
import { CarReviews } from "@/components/car-detail/car-reviews"
import { CarBookingForm } from "@/components/car-detail/car-booking-form"
import { CarCard } from "@/components/car-card"
import { useToast } from "@/hooks/use-toast"

export default function CarDetailPage({ params }: { params: { carId: string } }) {
  const [car, setCar] = useState<Car | null>(null)
  const [relatedCars, setRelatedCars] = useState<Car[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Fetch car data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // In a real app, this would be an API call
        const carData = CarService.getCarBySlug(params.carId)
        if (!carData) {
          router.push("/fleet")
          return
        }
        setCar(carData)

        // Get related cars
        const related = CarService.getRelatedCars(carData.id, 3)
        setRelatedCars(related)
      } catch (error) {
        console.error("Error fetching car data:", error)
        toast({
          title: "Error",
          description: "Failed to load car details. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [params.carId, router, toast])

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `exoDrive - ${car?.name}`,
          text: `Check out the ${car?.name} at exoDrive!`,
          url: window.location.href,
        })
        .catch(console.error)
    } else {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          toast({
            title: "Link copied",
            description: "Car link copied to clipboard!",
          })
        })
        .catch(console.error)
    }
  }

  if (isLoading || !car) {
    return (
      <div className="container py-10">
        <div className="h-6 w-40 bg-muted rounded animate-pulse mb-8" />
        <div className="h-10 w-64 bg-muted rounded animate-pulse mb-4" />
        <div className="h-6 w-full max-w-2xl bg-muted rounded animate-pulse mb-10" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="md:col-span-2">
            <div className="h-[400px] bg-muted rounded animate-pulse mb-4" />
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
          <div>
            <div className="h-[400px] bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-6 md:py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/fleet" className="hover:text-foreground flex items-center">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Our Fleet
          </Link>
          <span>/</span>
          <span>{car.name}</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">{car.name}</h1>
            <p className="text-muted-foreground mt-1">{car.shortDescription}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">${car.pricing.basePrice}/day</div>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="md:col-span-2">
          <CarImageGallery images={car.images} carName={car.name} />
        </div>

        <div>
          <div className="bg-card rounded-lg border shadow-sm p-6 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Book This Car</h2>
            <CarBookingForm carId={car.id} pricing={car.pricing} availability={car.availability} />
          </div>
        </div>
      </div>

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
              <CarOverview car={car} />
            </TabsContent>

            <TabsContent value="specs">
              <CarSpecifications specifications={car.specifications} />
            </TabsContent>

            <TabsContent value="features">
              <CarFeatures features={car.features} />
            </TabsContent>

            <TabsContent value="reviews">
              <CarReviews reviews={car.reviews} />
            </TabsContent>
          </Tabs>
        </div>

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
                <Button className="w-full bg-white text-black hover:bg-gray-100">Contact Us</Button>
                <Button variant="outline" className="w-full">
                  View Rental Policy
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

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
    </div>
  )
}

