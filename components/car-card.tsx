"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Gauge, Clock, Star, ChevronRight, ShieldCheck, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { getValidImageUrl, handleImageError, BACKUP_PLACEHOLDER_IMAGE } from "@/lib/utils/image-utils"
import type { Car as AppCar } from "@/lib/types/car"

interface CarCardProps {
  car: AppCar
  index?: number
  delay?: number
  variant?: "default" | "compact" | "featured"
  className?: string
  onPrefetch?: (slug: string) => void
}

export function CarCard({ car, index = 0, delay = 0, variant = "default", className, onPrefetch }: CarCardProps) {
  const isCompact = variant === "compact"
  const isFeatured = variant === "featured"
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)
  const [isPrecached, setIsPrecached] = useState(false)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const hasAttemptedLoad = useRef(false)

  // Use memoized values to prevent unnecessary re-renders
  const price = car?.pricePerDay ?? 0
  const carName = car?.name || "Luxury Car"
  const carCategory = car?.category || "luxury"
  const shortDescription = car?.shortDescription || (car?.description ? car.description.substring(0, 120) + "..." : "Experience luxury driving")
  const horsepower = car?.horsepower ? `${car.horsepower} hp` : null
  const acceleration = car?.acceleration060 ? `${car.acceleration060}s 0-60` : null
  const transmission = car?.transmission || null
  const topSpeed = car?.topSpeed ? `${car.topSpeed} mph` : null
  const isAvailable = car?.isAvailable !== false // Default to true if undefined

  // Initialize image source
  useEffect(() => {
    if (!hasAttemptedLoad.current) {
      const url = getValidImageUrl(car?.imageUrls?.[0])
      setImgSrc(url)
      hasAttemptedLoad.current = true
    }
  }, [car])

  const carLink = car?.slug ? `/fleet/${car.slug}` : `/fleet`

  const prefetchCarDetails = useCallback(async () => {
    if (!car?.slug) return

    try {
      await router.prefetch(carLink)
      if (onPrefetch) {
        onPrefetch(car.slug)
      }
    } catch (error) {
      console.error("Error prefetching car details:", error)
    }
  }, [car?.slug, router, onPrefetch, carLink])

  useEffect(() => {
    if (isHovered && !isPrecached) {
      const timer = setTimeout(() => {
        prefetchCarDetails()
        setIsPrecached(true)
      }, 200)

      return () => clearTimeout(timer)
    }
  }, [isHovered, isPrecached, prefetchCarDetails])

  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    handleImageError(e)
    // Update local state with new src after error handler runs
    setTimeout(() => {
      if (imgRef.current) {
        setImgSrc(imgRef.current.src)
      }
    }, 0)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: delay + index * 0.05 }}
      className={cn("h-full", className)}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card
        className={cn(
          "overflow-hidden h-full flex flex-col rounded-xl border transition-all duration-300",
          isHovered ? "shadow-xl border-primary/20 scale-[1.02]" : "hover:shadow-lg",
        )}
      >
        <div className={cn("relative overflow-hidden group", isCompact ? "h-44" : isFeatured ? "h-72" : "h-56")}>
          {imgSrc && (
            <Image
              ref={imgRef}
              src={imgSrc}
              alt={carName}
              fill
              className={cn(
                "object-cover transition-transform duration-700",
                isHovered ? "scale-110 brightness-105" : "group-hover:scale-105",
              )}
              onError={handleImgError}
              priority={index < 3}
              quality={80}
              sizes={isFeatured ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 100vw, 33vw"}
            />
          )}
          {!isAvailable && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="secondary" className="text-lg py-1.5">
                Currently Booked
              </Badge>
            </div>
          )}
          {car?.isFeatured && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-rose-600 hover:bg-rose-700">
                <Star className="mr-1 h-3 w-3" />
                Featured
              </Badge>
            </div>
          )}
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
              {carCategory}
            </Badge>
          </div>

          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30"
            >
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/90 hover:bg-white text-black"
                onClick={() => router.push(carLink)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Quick View
              </Button>
            </motion.div>
          )}

          {isFeatured && (
            <div className="absolute bottom-3 left-3">
              <Badge variant="outline" className="bg-background/90 backdrop-blur-sm text-lg py-1.5 px-3">
                ${price}/day
              </Badge>
            </div>
          )}
        </div>

        <CardContent
          className={cn("p-6 flex-grow flex flex-col", isCompact ? "p-4" : "", isHovered ? "bg-card/95" : "")}
        >
          <div className="mb-3">
            <h3 className={cn("font-bold", isCompact ? "text-lg" : "text-xl")}>{carName}</h3>
            {!isCompact && <p className="text-muted-foreground line-clamp-2 mt-1">{shortDescription}</p>}
          </div>

          {!isCompact && (
            <div className="grid grid-cols-2 gap-3 my-4">
              {horsepower && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Gauge className="h-4 w-4 mr-1 text-rose-600" />
                  <span>{horsepower}</span>
                </div>
              )}
              {acceleration && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1 text-rose-600" />
                  <span>{acceleration}</span>
                </div>
              )}
              {isFeatured && (
                <>
                  {transmission && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <ShieldCheck className="h-4 w-4 mr-1 text-rose-600" />
                      <span>{transmission}</span>
                    </div>
                  )}
                  {topSpeed && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Star className="h-4 w-4 mr-1 text-rose-600" />
                      <span>{topSpeed}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className={cn("mt-auto pt-4 flex items-center justify-between", isCompact ? "pt-2" : "")}>
            {!isFeatured && <span className={cn("font-bold", isCompact ? "text-base" : "text-lg")}>${price}/day</span>}
            <Badge variant={isAvailable ? "default" : "secondary"} className="capitalize">
              {isAvailable ? "Available" : "Booked"}
            </Badge>
          </div>

          <Button
            asChild
            className={cn(
              "w-full mt-4 group bg-[#eae2b7] hover:bg-[#eae2b7]/90 text-black",
              isHovered ? "shadow-md" : "",
            )}
          >
            <Link href={carLink} className="flex items-center justify-center">
              View Details
              <ChevronRight
                className={cn(
                  "ml-1 h-4 w-4 transition-transform",
                  isHovered ? "translate-x-1" : "group-hover:translate-x-1",
                )}
              />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

