"use client"

import { useState, useEffect } from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const media = window.matchMedia(query)

    // Set initial value
    setMatches(media.matches)

    // Create event listener
    const listener = () => {
      setMatches(media.matches)
    }

    // Add listener
    media.addEventListener("change", listener)

    // Clean up
    return () => media.removeEventListener("change", listener)
  }, [query])

  // Return false during SSR
  return isMounted ? matches : false
}

