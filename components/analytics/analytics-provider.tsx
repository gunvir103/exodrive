'use client'

import Script from 'next/script'
import { useEffect } from 'react'

// Type definitions for global analytics objects
declare global {
  interface Window {
    fbq?: (...args: any[]) => void
    _fbq?: any
    gtag?: (...args: any[]) => void
    dataLayer?: any[]
  }
}

interface AnalyticsProviderProps {
  metaPixelId?: string
  googleAnalyticsId?: string
}

export function AnalyticsProvider({ 
  metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID,
  googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID 
}: AnalyticsProviderProps) {
  // Validate environment variables
  useEffect(() => {
    if (metaPixelId && !isValidPixelId(metaPixelId)) {
      console.error('Invalid Meta Pixel ID format')
    }
    if (googleAnalyticsId && !isValidGoogleAnalyticsId(googleAnalyticsId)) {
      console.error('Invalid Google Analytics ID format')
    }
  }, [metaPixelId, googleAnalyticsId])

  // Initialize Meta Pixel
  useEffect(() => {
    if (!metaPixelId || typeof window === 'undefined') return

    // Initialize fbq function
    window.fbq = window.fbq || function() {
      (window.fbq as any).callMethod ?
        (window.fbq as any).callMethod.apply(window.fbq, arguments) :
        (window.fbq as any).queue.push(arguments)
    }
    
    if (!window._fbq) window._fbq = window.fbq;
    (window.fbq as any).push = window.fbq;
    (window.fbq as any).loaded = true;
    (window.fbq as any).version = '2.0';
    (window.fbq as any).queue = [];

    // Track PageView after initialization
    window.fbq('init', metaPixelId)
    window.fbq('track', 'PageView')
  }, [metaPixelId])

  // Initialize Google Analytics
  useEffect(() => {
    if (!googleAnalyticsId || typeof window === 'undefined') return

    window.dataLayer = window.dataLayer || []
    window.gtag = function() {
      window.dataLayer!.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', googleAnalyticsId)
  }, [googleAnalyticsId])

  return (
    <>
      {/* Meta Pixel Script */}
      {metaPixelId && (
        <Script
          id="facebook-pixel-script"
          strategy="afterInteractive"
          src="https://connect.facebook.net/en_US/fbevents.js"
        />
      )}

      {/* Google Analytics Scripts */}
      {googleAnalyticsId && (
        <>
          <Script
            id="google-analytics-script"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
          />
        </>
      )}
    </>
  )
}

// Validation functions
function isValidPixelId(id: string): boolean {
  // Meta Pixel IDs are typically 15-16 digit numbers
  return /^\d{15,16}$/.test(id)
}

function isValidGoogleAnalyticsId(id: string): boolean {
  // Google Analytics IDs follow the pattern: G-XXXXXXXXXX or UA-XXXXXXXX-X
  return /^(G-[A-Z0-9]{10}|UA-\d{6,9}-\d{1,2})$/.test(id)
}

// Export analytics helper functions
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, parameters)
  }
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters)
  }
}

export const trackCustomEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', eventName, parameters)
  }
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      event_category: 'custom',
      ...parameters
    })
  }
}