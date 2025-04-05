"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useToast } from "@/hooks/use-toast"
import { heroContentService } from "@/lib/services/hero-content-service"
import sanitizeHtml from "sanitize-html"

// Define types for hero content
export interface HeroContentData {
  id: string
  title: string
  subtitle: string
  backgroundType: "image" | "video"
  backgroundSrc: string
  badgeText: string
  primaryButtonText: string
  primaryButtonLink: string
  secondaryButtonText: string
  secondaryButtonLink: string
  isActive: boolean
}

// Fallback content that will always be available
export const fallbackHeroContent: HeroContentData = {
  id: "fallback-hero",
  title: "Drive Your *Dream Car* Today",
  subtitle: "Experience the thrill of driving the world's most exotic cars in the DMV area.",
  backgroundType: "image",
  backgroundSrc: "/placeholder.svg?height=1080&width=1920&text=Luxury+Supercar",
  badgeText: "Premium Experience",
  primaryButtonText: "Browse Our Fleet",
  primaryButtonLink: "/fleet",
  secondaryButtonText: "Rent Now",
  secondaryButtonLink: "https://www.instagram.com/exodriveexotics/?igsh=MTNwNzQ3a3c1a2xieQ%3D%3D#",
  isActive: true,
};

interface HeroContentContextType {
  heroContent: HeroContentData | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  updateHero: (id: string, data: Partial<HeroContentData>) => Promise<void>
  createHero: (data: Omit<HeroContentData, "id">) => Promise<void>
  deleteHero: (id: string) => Promise<void>
  setActiveHero: (id: string) => Promise<void>
}

// Create context with default values
const HeroContentContext = createContext<HeroContentContextType>({
  heroContent: fallbackHeroContent, // Always provide the fallback
  isLoading: false,
  error: null,
  refetch: async () => {},
  updateHero: async () => {},
  createHero: async () => {},
  deleteHero: async () => {},
  setActiveHero: async () => {},
})

// Custom hook to use the hero content context
export const useHeroContent = () => useContext(HeroContentContext)

// Simple HTML sanitization function
const sanitizeContent = (html: string): string => {
  // This is a basic implementation - in production, use a library like DOMPurify
  return sanitizeHtml(html, {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {}, // No attributes allowed
  })
}

// Provider component
export const HeroContentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [heroContent, setHeroContent] = useState<HeroContentData | null>(fallbackHeroContent)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  const fetchData = async () => {
    setIsLoading(true)
    
    try {
      const data = await heroContentService.getActiveHero()

      // Sanitize data to prevent XSS
      const sanitizedData = {
        ...data,
        title: sanitizeContent(data.title),
        subtitle: sanitizeContent(data.subtitle),
        badgeText: sanitizeContent(data.badgeText),
        primaryButtonText: sanitizeContent(data.primaryButtonText),
        secondaryButtonText: sanitizeContent(data.secondaryButtonText),
      }

      setHeroContent(sanitizedData)
      setError(null) // Clear any previous errors
    } catch (err) {
      console.error("Failed to fetch hero content:", err)
      setError(err instanceof Error ? err : new Error("Failed to fetch hero content"))
      // Don't set heroContent to null, keep the fallback
      toast({
        title: "Warning",
        description: "Using fallback hero content. You may need to refresh.",
        variant: "default",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateHero = async (id: string, data: Partial<HeroContentData>) => {
    try {
      await heroContentService.updateHero(id, data)
      toast({
        title: "Success",
        description: "Hero content updated successfully.",
      })
      fetchData() // Refresh data
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update hero content.",
        variant: "destructive",
      })
      throw err
    }
  }

  const createHero = async (data: Omit<HeroContentData, "id">) => {
    try {
      await heroContentService.createHero(data)
      toast({
        title: "Success",
        description: "Hero content created successfully.",
      })
      fetchData() // Refresh data
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create hero content.",
        variant: "destructive",
      })
      throw err
    }
  }

  const deleteHero = async (id: string) => {
    try {
      await heroContentService.deleteHero(id)
      toast({
        title: "Success",
        description: "Hero content deleted successfully.",
      })
      fetchData() // Refresh data
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete hero content.",
        variant: "destructive",
      })
      throw err
    }
  }

  const setActiveHero = async (id: string) => {
    try {
      await heroContentService.setActiveHero(id)
      toast({
        title: "Success",
        description: "Active hero updated successfully.",
      })
      fetchData() // Refresh data
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update active hero.",
        variant: "destructive",
      })
      throw err
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <HeroContentContext.Provider
      value={{
        heroContent,
        isLoading,
        error,
        refetch: fetchData,
        updateHero,
        createHero,
        deleteHero,
        setActiveHero,
      }}
    >
      {children}
    </HeroContentContext.Provider>
  )
}

