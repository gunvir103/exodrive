import type React from "react"
// Constants for image handling
export const DEFAULT_PLACEHOLDER_IMAGE =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%20Apr%202%2C%202025%2C%2009_34_50%20PM-NauHAGMA7F8w9gIQ7dqc9yC8aOFTjS.png"

// Optional backup placeholder if the main one fails
export const BACKUP_PLACEHOLDER_IMAGE = 
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f1f1'/%3E%3Cpath d='M30,40 L70,40 L70,60 L30,60 Z' fill='none' stroke='%23bbb' stroke-width='2'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='10' text-anchor='middle' alignment-baseline='middle' fill='%23999'%3ENo Image%3C/text%3E%3C/svg%3E"

/**
 * Returns a valid image URL or falls back to the default placeholder
 * @param url The original image URL to check
 * @param alt Optional alt text to include in the placeholder URL
 * @returns A valid image URL
 */
export function getValidImageUrl(url?: string | null, alt?: string): string {
  if (!url) return DEFAULT_PLACEHOLDER_IMAGE;

  // Check for empty string
  if (url.trim() === "") return DEFAULT_PLACEHOLDER_IMAGE;

  // Basic URL validation
  try {
    new URL(url);
    return url;
  } catch (e) {
    console.warn(`Invalid image URL: ${url}`, e);
    return DEFAULT_PLACEHOLDER_IMAGE;
  }
}

/**
 * Handles image loading errors by replacing with the default placeholder
 * @param event The error event from the image
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement, Event>): void {
  const img = event.currentTarget;
  
  // Double check we're not already using either placeholder to avoid infinite loops
  if (img.src !== DEFAULT_PLACEHOLDER_IMAGE && img.src !== BACKUP_PLACEHOLDER_IMAGE) {
    console.warn(`Image failed to load: ${img.src}, replacing with placeholder`);
    try {
      img.src = DEFAULT_PLACEHOLDER_IMAGE;
      
      // Add a second error handler in case the default placeholder fails
      img.onerror = () => {
        if (img.src !== BACKUP_PLACEHOLDER_IMAGE) {
          console.warn(`Default placeholder failed, using backup`);
          img.src = BACKUP_PLACEHOLDER_IMAGE;
          img.onerror = null; // Clear the error handler
        }
      };
    } catch (e) {
      console.error(`Failed to set placeholder image:`, e);
      // Last resort
      img.src = BACKUP_PLACEHOLDER_IMAGE;
    }
  }
}

