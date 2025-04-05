import { createBrowserClient } from '@supabase/ssr' // Import browser client
import { handleSupabaseError } from "@/lib/supabase/client"
import type { HeroContentData } from "@/contexts/hero-content-context"

// Mock data for when Supabase isn't available
const mockHeroContent: HeroContentData = {
  id: "default-hero",
  title: "Drive Your *Dream Car* Today",
  subtitle: "Experience the thrill of driving the world's most exotic cars in the DMV area. No membership required.",
  backgroundType: "image",
  backgroundSrc: "/placeholder.svg?height=1080&width=1920&text=Luxury+Supercar",
  badgeText: "Premium Experience",
  primaryButtonText: "Browse Our Fleet",
  primaryButtonLink: "/fleet",
  secondaryButtonText: "Rent Now",
  secondaryButtonLink: "https://www.instagram.com/exodriveexotics/?igsh=MTNwNzQ3a3c1a2xieQ%3D%3D#",
  isActive: true,
}

export const heroContentService = {
  // Get active hero content - REFACTORED FOR CLIENT-SIDE USE
  getActiveHero: async (): Promise<HeroContentData> => {
    // Create a client-side client
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    try {
      // Fetches using the PUBLIC Anon Key (respects RLS)
      const { data, error } = await supabase.from("hero_content").select("*").eq("is_active", true).maybeSingle()

      if (error) throw error
      if (!data) {
        console.warn("No active hero content found, using mock data.")
        return mockHeroContent // Keep mock data fallback
      }

      // Transform from snake_case to camelCase
      return {
        id: data.id,
        title: data.title,
        subtitle: data.subtitle,
        backgroundType: data.background_type,
        backgroundSrc: data.background_src,
        badgeText: data.badge_text,
        primaryButtonText: data.primary_button_text,
        primaryButtonLink: data.primary_button_link,
        secondaryButtonText: data.secondary_button_text,
        secondaryButtonLink: data.secondary_button_link,
        isActive: data.is_active,
      }
    } catch (error) {
      console.warn("Error fetching hero content from Supabase, using mock data:", error)
      return mockHeroContent
    }
  },

  // Get all hero content items (NEEDS REFACTORING - Uses Service Client)
  getAllHeroes: async (): Promise<HeroContentData[]> => {
    // const supabase = getServiceClient() // PROBLEM!
    // ... implementation ...
    console.error("getAllHeroes currently uses Service Client - needs refactoring!")
    return [mockHeroContent] // Temporary fallback
  },

  // Create new hero content (NEEDS REFACTORING - Uses Service Client)
  createHero: async (heroData: Omit<HeroContentData, "id">): Promise<HeroContentData> => {
    // const supabase = getServiceClient() // PROBLEM!
    // ... implementation ...
    console.error("createHero currently uses Service Client - needs refactoring!")
    throw new Error("createHero not available from client-side service.")
  },

  // Update hero content (NEEDS REFACTORING - Uses Service Client)
  updateHero: async (id: string, heroData: Partial<HeroContentData>): Promise<HeroContentData> => {
    // const supabase = getServiceClient() // PROBLEM!
    // ... implementation ...
    console.error("updateHero currently uses Service Client - needs refactoring!")
    throw new Error("updateHero not available from client-side service.")
  },

  // Delete hero content (NEEDS REFACTORING - Uses Service Client)
  deleteHero: async (id: string): Promise<void> => {
    // const supabase = getServiceClient() // PROBLEM!
    // ... implementation ...
    console.error("deleteHero currently uses Service Client - needs refactoring!")
    throw new Error("deleteHero not available from client-side service.")
  },

  // Set a hero as active (NEEDS REFACTORING - Uses Service Client)
  setActiveHero: async (id: string): Promise<void> => {
    // const supabase = getServiceClient() // PROBLEM!
    // ... implementation ...
    console.error("setActiveHero currently uses Service Client - needs refactoring!")
    throw new Error("setActiveHero not available from client-side service.")
  },
}

