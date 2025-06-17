'use client'

import { useEffect, useState, useRef, Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useInView } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Shield, Car, Star, Zap, MapPin, Instagram } from "lucide-react"
import { CarCard } from "@/components/car-card"
import type { AppCar } from "@/lib/services/car-service-supabase"
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import { HeroSection } from "@/components/hero-section"
import { Skeleton } from "@/components/ui/skeleton"
import { getValidImageUrl, handleImageError } from "@/lib/utils/image-utils"

// Simple CountUp component remains the same
function CountUp({ target, duration = 1.5 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    setCount(0)
    const totalFrames = Math.min(duration / 16, 100) 
    const increment = target > 0 ? target / totalFrames : 0
    let currentCount = 0
    let frame = 0
    const counter = setInterval(() => {
      currentCount = Math.min(currentCount + increment, target)
      setCount(Math.floor(currentCount))
      frame++
      if (frame >= totalFrames) {
        clearInterval(counter)
        setCount(target)
      }
    }, 16)
    return () => clearInterval(counter)
  }, [target, duration])
  return <>{count}</>
}

// Client Component Part
interface HomeClientComponentProps {
  initialCars: any[]; // Keep as any for optimized list
  initialError: string | null;
  featuredCar: AppCar | null; 
}

export default function HomeClientComponent({ initialCars, initialError, featuredCar }: HomeClientComponentProps) {
  const featuredRef = useRef(null)
  const isInView = useInView(featuredRef, { once: true, amount: 0.2 })
  const [cars, setCars] = useState<any[]>(initialCars)
  const [error, setError] = useState<string | null>(initialError)

  // Use the featuredCar prop directly to get the image URL
  // Use optional chaining and provide a fallback
  const featuredCarImageUrl = getValidImageUrl(featuredCar?.images?.find(img => img.is_primary)?.url ?? featuredCar?.images?.[0]?.url)
    || "/placeholder.svg?text=Featured+Car";

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <HeroSection
        title="Experience Luxury on the Road"
        subtitle="Rent the finest luxury cars for your journey. From sleek sports cars to elegant sedans, we have the perfect vehicle for every occasion."
        badgeText="Premium Luxury Car Rental"
        primaryButtonText="Browse Our Fleet"
        primaryButtonLink="/fleet"
        secondaryButtonText="Contact Us"
        secondaryButtonLink="/contact"
        particlesConfig={{ position: "bottom", color: "#D4AF37", quantity: 40, speed: 1, opacity: 0.3, height: "40%" }}
      />

      {/* Bento Grid Section */}
      <section id="features" className="py-20 bg-background">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, amount: 0.2 }}
            className="mb-12 text-center"
          >
            <h2 className="text-3xl font-bold mb-4 md:text-4xl">
              Experience <span className="text-[#eae2b7]">Luxury</span> Like Never Before
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Discover our collection of the world's finest automobiles, ready for your next adventure.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Large Feature Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true, amount: 0.2 }}
              className="md:col-span-8 bento-enhanced rounded-xl overflow-hidden shadow-lg"
            >
              <div className="relative h-[400px]">
                {error ? (
                  <Skeleton className="absolute inset-0" />
                ) : (
                  <Image
                    src={featuredCarImageUrl}
                    alt={featuredCar?.name || "Featured luxury car"}
                    fill
                    priority
                    className="object-cover"
                    onError={handleImageError}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  {featuredCar ? (
                    <>
                      <Badge className="mb-2 bg-[#eae2b7] text-black" variant="outline">
                        Featured
                      </Badge>
                      <h3 className="text-2xl font-bold mb-2">{featuredCar.name}</h3>
                      <p className="mb-4 text-gray-200 line-clamp-2">
                        {featuredCar.short_description || "Luxury vehicle details not available."}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold">
                          {featuredCar.pricing?.base_price ? `$${featuredCar.pricing.base_price}/day` : "Price unavailable"}
                        </span>
                        <Button asChild size="sm" className="bg-[#eae2b7] hover:bg-[#eae2b7]/90 text-black">
                          <Link href={`/fleet/${featuredCar.slug}`}>View Details</Link>
                        </Button>
                      </div>
                    </>
                  ) : error ? (
                    <p className="text-destructive">Error loading featured car.</p>
                  ) : (
                    <>
                      <Skeleton className="h-6 w-1/4 mb-2" />
                      <Skeleton className="h-8 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full mb-4" />
                      <Skeleton className="h-4 w-full mb-4" />
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-9 w-1/4" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Stats Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true, amount: 0.2 }}
              className="md:col-span-4 bento-enhanced rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-[#0a0a0a] to-[#333333] text-white"
            >
              <div className="p-6">
                <h3 className="text-xl font-bold mb-4">ExoDrive Experience</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                      <Car className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        <CountUp target={cars.length} />+
                      </div>
                      <div className="text-sm text-white/80">Exotic Cars</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                      <Star className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">500+</div>
                      <div className="text-sm text-white/80">Happy Customers</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">DMV Area</div>
                      <div className="text-sm text-white/80">Service Coverage</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* How It Works Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true, amount: 0.2 }}
              className="md:col-span-4 bento-enhanced rounded-xl overflow-hidden shadow-lg bg-white dark:bg-[#0a0a0a]"
            >
              <div className="p-6">
                <h3 className="text-xl font-bold mb-4">How It Works</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-[#0a0a0a] to-[#333333] p-2 rounded-full text-white">
                      <Car className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">Choose Your Car</h4>
                      <p className="text-sm text-muted-foreground">
                        Browse our fleet and select the exotic car of your dreams.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-[#0a0a0a] to-[#333333] p-2 rounded-full text-white">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">Verify & Pay</h4>
                      <p className="text-sm text-muted-foreground">
                        Complete identity verification and secure your booking.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-[#0a0a0a] to-[#333333] p-2 rounded-full text-white">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">Drive & Enjoy</h4>
                      <p className="text-sm text-muted-foreground">
                        Pick up your car and enjoy the ultimate driving experience.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Testimonial Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true, amount: 0.2 }}
              className="md:col-span-8 bento-enhanced rounded-xl overflow-hidden shadow-lg bg-white dark:bg-[#0a0a0a]"
            >
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="relative w-full md:w-1/3 h-48 md:h-auto rounded-lg overflow-hidden">
                    <Image
                      src="/placeholder.svg?height=400&width=300&text=Customer"
                      alt="Customer testimonial"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="md:w-2/3">
                    <div className="flex mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      ))}
                    </div>
                    <blockquote className="text-lg italic mb-4">
                      "The Ferrari 488 was an absolute dream to drive. The service was impeccable from start to finish.
                      ExoDrive made my weekend getaway truly unforgettable!"
                    </blockquote>
                    <div>
                      <p className="font-bold">Alex Johnson</p>
                      <p className="text-sm text-muted-foreground">Washington, DC</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true, amount: 0.2 }}
              className="md:col-span-4 bento-enhanced rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-[#d62828] to-[#ac2020] text-white"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-white/20 p-2 rounded-full">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold">Performance</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-white/80">Top Speed</p>
                    <p className="text-2xl font-bold">200+ MPH</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/80">0-60 MPH</p>
                    <p className="text-2xl font-bold">Under 3 Seconds</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/80">Horsepower</p>
                    <p className="text-2xl font-bold">Up to 700+</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* CTA Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              viewport={{ once: true, amount: 0.2 }}
              className="md:col-span-8 bento-enhanced rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-[#0a0a0a] to-[#333333] text-white"
            >
              <div className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Ready to Experience Luxury?</h3>
                    <p className="text-white/90 mb-4 md:mb-0">
                      Browse our collection of exotic cars and book your unforgettable driving experience today.
                    </p>
                  </div>
                  <Button size="lg" variant="secondary" asChild className="whitespace-nowrap">
                    <a
                      href="https://www.instagram.com/exodriveexotics/?igsh=MTNwNzQ3a3c1a2xieQ%3D%3D#"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Instagram className="mr-2 h-4 w-4" />
                      Rent Now
                    </a>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Cars Section */}
      <section ref={featuredRef} className="py-20 bg-muted/30">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <h2 className="text-3xl font-bold mb-4 md:text-4xl">
              <span className="text-[#eae2b7]">Featured</span>{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#d62828] to-[#ac2020]">
                Vehicles
              </span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Our most popular exotic cars available for rent
            </p>
          </motion.div>

          <div className="relative">
            {error ? (
              <p className="text-center text-destructive">Error loading cars: {error}</p>
            ) : cars.length === 0 ? (
              <div className="flex space-x-4 overflow-hidden">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="min-w-0 flex-shrink-0 w-full md:w-1/2 lg:w-1/3 p-1">
                    <Skeleton className="h-[450px] rounded-xl" />
                  </div>
                ))}
              </div>
            ) : (
              <Carousel
                opts={{
                  align: "start",
                  loop: cars.length > 2, // Only loop if enough cars
                  duration: 50,
                  dragFree: true,
                }}
                className="w-full"
                plugins={[
                  Autoplay({
                    delay: 5000,
                    stopOnInteraction: true,
                  }),
                ]}
              >
                <CarouselContent className="-ml-1">
                  {cars.map((car, index) => (
                    <CarouselItem key={car.id} className="pl-1 md:basis-1/2 lg:basis-1/3">
                      <div className="p-1 h-full">
                        <CarCard car={car} index={index} delay={0} variant={car.isFeatured ? "featured" : "default"} />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            )}
            {!error && cars.length > 0 && (
              <p className="text-center text-sm text-muted-foreground mt-4">Swipe or drag to navigate</p>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#0a0a0a] to-[#333333] text-white">
        <div className="container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, amount: 0.2 }}
          >
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Ready to Drive Your{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#d62828] to-[#ac2020]">
                Dream Car
              </span>
              ?
            </h2>
            <p className="mb-8 mx-auto max-w-2xl text-lg text-white/90">
              Browse our collection of exotic cars and book your unforgettable driving experience today.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" variant="secondary" asChild className="hover-lift">
                <Link href="/fleet">Browse Our Fleet</Link>
              </Button>
              <Button size="lg" asChild className="hover-lift bg-[#eae2b7] hover:bg-[#eae2b7]/90 text-black">
                <a
                  href="https://www.instagram.com/exodriveexotics/?igsh=MTNwNzQ3a3c1a2xieQ%3D%3D#"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram className="mr-2 h-4 w-4" />
                  Rent Now
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
} 