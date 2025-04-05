import type React from "react"
// Constants for image handling
export const DEFAULT_PLACEHOLDER_IMAGE =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%20Apr%202%2C%202025%2C%2009_34_50%20PM-NauHAGMA7F8w9gIQ7dqc9yC8aOFTjS.png"

/**
 * Returns a valid image URL or falls back to the default placeholder
 * @param url The original image URL to check
 * @param alt Optional alt text to include in the placeholder URL
 * @returns A valid image URL
 */
export function getValidImageUrl(url?: string | null, alt?: string): string {
  if (!url) return DEFAULT_PLACEHOLDER_IMAGE

  // Basic URL validation
  try {
    new URL(url)
    return url
  } catch (e) {
    // If URL is invalid, return the placeholder
    return DEFAULT_PLACEHOLDER_IMAGE
  }
}

/**
 * Handles image loading errors by replacing with the default placeholder
 * @param event The error event from the image
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement, Event>): void {
  const img = event.currentTarget
  if (img.src !== DEFAULT_PLACEHOLDER_IMAGE) {
    img.src = DEFAULT_PLACEHOLDER_IMAGE
  }
}

