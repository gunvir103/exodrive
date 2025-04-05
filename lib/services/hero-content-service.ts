import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
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

// Helper function to create service client, handling potential errors
function getServiceClient() {
  try {
    return createSupabaseServiceRoleClient()
  } catch (error) {
    console.error("Failed to create Supabase Service Client:", error)
    return null
  }
}

export const heroContentService = {
  // Get active hero content
  getActiveHero: async (): Promise<HeroContentData> => {
    const supabase = getServiceClient()

    if (!supabase) {
      console.warn("Using mock hero content data due to service client initialization failure.")
      return mockHeroContent
    }

    try {
      // Fetches using Service Role Client (bypasses RLS)
      const { data, error } = await supabase.from("hero_content").select("*").eq("is_active", true).maybeSingle()

      if (error) throw error
      if (!data) {
        console.warn("No active hero content found, using mock data.")
        return mockHeroContent
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

  // Get all hero content items
  getAllHeroes: async (): Promise<HeroContentData[]> => {
    const supabase = getServiceClient()

    if (!supabase) {
      console.warn("Using mock hero content data for getAllHeroes due to service client failure.")
      return [mockHeroContent]
    }

    try {
      const { data, error } = await supabase.from("hero_content").select("*").order("created_at", { ascending: false })

      if (error) throw error
      if (!data) return []

      // Transform from snake_case to camelCase
      return data.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        backgroundType: item.background_type,
        backgroundSrc: item.background_src,
        badgeText: item.badge_text,
        primaryButtonText: item.primary_button_text,
        primaryButtonLink: item.primary_button_link,
        secondaryButtonText: item.secondary_button_text,
        secondaryButtonLink: item.secondary_button_link,
        isActive: item.is_active,
      }))
    } catch (error) {
      console.warn("Error fetching all hero content from Supabase, returning mock data:", error)
      return [mockHeroContent]
    }
  },

  // Create new hero content
  createHero: async (heroData: Omit<HeroContentData, "id">): Promise<HeroContentData> => {
    const supabase = getServiceClient()
    if (!supabase) {
      throw new Error("Supabase service client not available for create operation.")
    }
    
    try {
      // Transform from camelCase to snake_case for insertion
      const insertData = {
        title: heroData.title,
        subtitle: heroData.subtitle,
        background_type: heroData.backgroundType,
        background_src: heroData.backgroundSrc,
        badge_text: heroData.badgeText,
        primary_button_text: heroData.primaryButtonText,
        primary_button_link: heroData.primaryButtonLink,
        secondary_button_text: heroData.secondaryButtonText,
        secondary_button_link: heroData.secondaryButtonLink,
        is_active: heroData.isActive,
      }

      const { data, error } = await supabase
        .from("hero_content")
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      if (!data) throw new Error("Failed to create hero content: No data returned.")

      // Transform back to camelCase for return
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
      throw new Error(handleSupabaseError(error))
    }
  },

  // Update hero content
  updateHero: async (id: string, heroData: Partial<HeroContentData>): Promise<HeroContentData> => {
    const supabase = getServiceClient()
    if (!supabase) {
      throw new Error("Supabase service client not available for update operation.")
    }

    try {
      // Transform partial camelCase to partial snake_case for update
      const updateData: Record<string, any> = {}
      if (heroData.title !== undefined) updateData.title = heroData.title
      if (heroData.subtitle !== undefined) updateData.subtitle = heroData.subtitle
      if (heroData.backgroundType !== undefined) updateData.background_type = heroData.backgroundType
      if (heroData.backgroundSrc !== undefined) updateData.background_src = heroData.backgroundSrc
      if (heroData.badgeText !== undefined) updateData.badge_text = heroData.badgeText
      if (heroData.primaryButtonText !== undefined) updateData.primary_button_text = heroData.primaryButtonText
      if (heroData.primaryButtonLink !== undefined) updateData.primary_button_link = heroData.primaryButtonLink
      if (heroData.secondaryButtonText !== undefined) updateData.secondary_button_text = heroData.secondaryButtonText
      if (heroData.secondaryButtonLink !== undefined) updateData.secondary_button_link = heroData.secondaryButtonLink
      if (heroData.isActive !== undefined) updateData.is_active = heroData.isActive
      
      if (Object.keys(updateData).length === 0) {
        // If no fields to update, maybe fetch and return current state or throw error?
        // For now, let's throw an error indicating nothing was updated.
        throw new Error("No valid fields provided for hero update.")
      }

      const { data, error } = await supabase
        .from("hero_content")
        .update(updateData)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      if (!data) throw new Error(`Failed to update hero content ${id}: No data returned.`)

      // Transform back to camelCase for return
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
      throw new Error(handleSupabaseError(error))
    }
  },

  // Delete hero content
  deleteHero: async (id: string): Promise<void> => {
    const supabase = getServiceClient()
    if (!supabase) {
      throw new Error("Supabase service client not available for delete operation.")
    }

    try {
      const { error } = await supabase.from("hero_content").delete().eq("id", id)
      if (error) throw error
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  },

  // Set a hero as active (Requires Service Role Client)
  // Assumes an RPC function `set_active_hero` exists in the database.
  setActiveHero: async (id: string): Promise<void> => {
    const supabase = getServiceClient()
    if (!supabase) {
      throw new Error("Supabase service client not available for setActiveHero operation.")
    }

    try {
      const { error } = await supabase.rpc("set_active_hero", { hero_id: id })
      if (error) throw error
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  },
}

