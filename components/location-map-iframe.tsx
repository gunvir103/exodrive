"use client"

import { useState, useEffect } from "react"
import { MapPin } from "lucide-react"

interface LocationMapProps {
  address: string
  className?: string
}

export function LocationMapIframe({ address, className }: LocationMapProps) {
  const [isMounted, setIsMounted] = useState(false)

  // Encode the address for the URL
  const encodedAddress = encodeURIComponent(address)
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${encodedAddress}&zoom=15`

  // Only render the iframe on the client side
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Fallback for when the map is loading or fails
  const MapFallback = () => (
    <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-lg border">
      <div className="text-center p-6">
        <MapPin className="h-10 w-10 text-primary mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Map Loading...</h3>
        <p className="text-muted-foreground">
          If the map doesn't load, please visit us at:
          <br />
          <span className="font-medium">{address}</span>
        </p>
      </div>
    </div>
  )

  return (
    <div className={`w-full h-[400px] rounded-lg overflow-hidden ${className}`}>
      {isMounted ? (
        <iframe
          title="exoDrive Location"
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0 }}
          src={mapUrl}
          allowFullScreen
        ></iframe>
      ) : (
        <MapFallback />
      )}
    </div>
  )
}

