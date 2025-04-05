"use client"

import { useState, useEffect } from "react"
import { MapPin } from "lucide-react"

interface LocationMapProps {
  address: string
  className?: string
  lat?: number
  lng?: number
}

export function LocationMapOSM({ address, className, lat = 39.084, lng = -77.1528 }: LocationMapProps) {
  const [isMounted, setIsMounted] = useState(false)

  // OpenStreetMap URL
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`

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
        <div className="relative w-full h-full">
          <iframe
            title="exoDrive Location"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            marginHeight={0}
            marginWidth={0}
            src={mapUrl}
            style={{ border: 0 }}
          ></iframe>
          <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm p-2 text-center text-xs">
            <a
              href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              View Larger Map
            </a>
            {" | "}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Get Directions
            </a>
          </div>
        </div>
      ) : (
        <MapFallback />
      )}
    </div>
  )
}

