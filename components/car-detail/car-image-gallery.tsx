"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { CarImage } from "@/lib/types/car"
import { cn } from "@/lib/utils"
import { getValidImageUrl, handleImageError } from "@/lib/utils/image-utils"

interface CarImageGalleryProps {
  images: CarImage[]
  carName: string
}

export function CarImageGallery({ images, carName }: CarImageGalleryProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [sortedImages, setSortedImages] = useState<CarImage[]>([])

  useEffect(() => {
    // Sort images by sortOrder and ensure primary image is first
    const primaryIndex = images.findIndex((img) => img.isPrimary)
    if (primaryIndex !== -1) {
      const primary = images[primaryIndex]
      const rest = images.filter((img) => !img.isPrimary).sort((a, b) => a.sortOrder - b.sortOrder)
      setSortedImages([primary, ...rest])
      setActiveImageIndex(0)
    } else {
      setSortedImages([...images].sort((a, b) => a.sortOrder - b.sortOrder))
    }
  }, [images])

  const nextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % sortedImages.length)
  }

  const prevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + sortedImages.length) % sortedImages.length)
  }

  if (sortedImages.length === 0) {
    return (
      <div className="relative h-[300px] md:h-[400px] rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        <Image
          src={getValidImageUrl(null, `${carName || "/placeholder.svg"} - No images available`)}
          alt={`${carName} - No images available`}
          fill
          className="object-contain"
          onError={handleImageError}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeImageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative h-[300px] md:h-[400px] rounded-lg overflow-hidden"
          >
            <Image
              src={getValidImageUrl(sortedImages[activeImageIndex]?.url, `${carName || "/placeholder.svg"} view`)}
              alt={sortedImages[activeImageIndex]?.alt || `${carName} view`}
              fill
              className="object-cover"
              priority
              onError={handleImageError}
            />
          </motion.div>
        </AnimatePresence>

        <button
          onClick={prevImage}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 text-black backdrop-blur-sm p-2 rounded-full shadow-md hover:bg-white transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={nextImage}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 text-black backdrop-blur-sm p-2 rounded-full shadow-md hover:bg-white transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-2">
        {sortedImages.map((image, i) => (
          <motion.div
            key={image.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "relative h-20 rounded-lg overflow-hidden cursor-pointer transition-all",
              activeImageIndex === i ? "ring-2 ring-primary" : "ring-1 ring-border",
            )}
            onClick={() => setActiveImageIndex(i)}
          >
            <Image
              src={getValidImageUrl(image.url, `${carName || "/placeholder.svg"} thumbnail ${i + 1}`)}
              alt={image.alt || `${carName} thumbnail ${i + 1}`}
              fill
              className="object-cover"
              onError={handleImageError}
            />
            {image.isPrimary && (
              <div className="absolute bottom-0 left-0 right-0 bg-primary/70 text-[10px] text-center text-primary-foreground py-0.5">
                Primary
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

