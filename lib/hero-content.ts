// This would normally come from a database
export interface HeroContent {
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

// Sample hero content
export const heroContents: HeroContent[] = [
  {
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
  },
  {
    id: "summer-special",
    title: "Summer *Special* Offers",
    subtitle: "Take advantage of our limited-time summer discounts on all exotic car rentals.",
    backgroundType: "image",
    backgroundSrc: "/placeholder.svg?height=1080&width=1920&text=Summer+Special",
    badgeText: "Limited Time Offer",
    primaryButtonText: "View Offers",
    primaryButtonLink: "/offers",
    secondaryButtonText: "Book Now",
    secondaryButtonLink: "/contact",
    isActive: false,
  },
]

// Get the active hero content
export function getActiveHeroContent(): HeroContent {
  const activeHero = heroContents.find((hero) => hero.isActive)
  return activeHero || heroContents[0]
}

// Update hero content
export function updateHeroContent(id: string, updates: Partial<HeroContent>): HeroContent | null {
  const index = heroContents.findIndex((hero) => hero.id === id)
  if (index === -1) return null

  heroContents[index] = { ...heroContents[index], ...updates }
  return heroContents[index]
}

// Set a hero as active
export function setActiveHero(id: string): boolean {
  const index = heroContents.findIndex((hero) => hero.id === id)
  if (index === -1) return false

  // Set all heroes to inactive
  heroContents.forEach((hero) => (hero.isActive = false))

  // Set the selected hero to active
  heroContents[index].isActive = true
  return true
}

// Add a new hero
export function addHeroContent(hero: Omit<HeroContent, "id">): HeroContent {
  const id = `hero-${Date.now()}`
  const newHero = { id, ...hero }
  heroContents.push(newHero)
  return newHero
}

// Delete a hero
export function deleteHeroContent(id: string): boolean {
  const index = heroContents.findIndex((hero) => hero.id === id)
  if (index === -1) return false

  // Don't delete if it's the only hero
  if (heroContents.length <= 1) return false

  // If deleting the active hero, set another one as active
  if (heroContents[index].isActive && heroContents.length > 1) {
    const newActiveIndex = index === 0 ? 1 : 0
    heroContents[newActiveIndex].isActive = true
  }

  heroContents.splice(index, 1)
  return true
}

