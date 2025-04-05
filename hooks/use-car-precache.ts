"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface UsePrecacheOptions {
  enabled?: boolean
  delay?: number
  onSuccess?: () => void
  onError?: (error: Error) => void
}

/**
 * A hook to pre-cache car details and assets
 */
export function useCarPrecache(carId: string, imageUrls: string[], options: UsePrecacheOptions = {}) {
  const { enabled = true, delay = 200, onSuccess, onError } = options

  const [isPrecached, setIsPrecached] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const router = useRouter()

  // Function to trigger precaching manually
  const precache = async () => {
    if (!enabled || isPrecached || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      // Prefetch the car detail page
      router.prefetch(`/fleet/${carId}`)

      // Preload images
      const imagePromises = imageUrls.map((url) => {
        return new Promise<void>((resolve, reject) => {
          if (!url) {
            resolve()
            return
          }

          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
          img.src = url
        })
      })

      // Wait for all images to load
      await Promise.all(imagePromises)

      setIsPrecached(true)
      onSuccess?.()
    } catch (error) {
      // Safely handle the error without destructuring
      console.error("Error prefetching car details:", error)
      // Set error state without trying to access properties that might not exist
      setError(error instanceof Error ? error.message : "An unknown error occurred")
      onError?.(new Error(error instanceof Error ? error.message : "An unknown error occurred"))
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-precache when enabled changes to true
  useEffect(() => {
    if (enabled && !isPrecached && !isLoading) {
      const timer = setTimeout(() => {
        precache()
      }, delay)

      return () => clearTimeout(timer)
    }
  }, [enabled, isPrecached, isLoading])

  return {
    isPrecached,
    isLoading,
    error,
    precache,
  }
}

