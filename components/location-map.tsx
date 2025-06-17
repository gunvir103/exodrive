"use client"

import { useState, useCallback } from "react"
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api"

interface LocationMapProps {
  address: string
  className?: string
}

const containerStyle = {
  width: "100%",
  height: "100%",
}

// Rockville, MD coordinates
const defaultCenter = {
  lat: 39.084,
  lng: -77.1528,
}

// Declare google variable
declare global {
  interface Window {
    google: any
  }
}

export function LocationMap({ address, className }: LocationMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [isInfoWindowOpen, setIsInfoWindowOpen] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [markerIcon, setMarkerIcon] = useState<any>(null)

  // This would normally come from an environment variable
  const googleMapsApiKey = "YOUR_API_KEY"

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
    setMapLoaded(true)

    // Only set the marker icon after the map has loaded
    if (window.google && window.google.maps) {
      setMarkerIcon({
        url: "/placeholder.svg?height=40&width=40&text=exo",
        scaledSize: new window.google.maps.Size(40, 40),
      })
    }
  }, [])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  // Fallback for when Google Maps fails to load
  const MapFallback = () => (
    <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-lg border">
      <div className="text-center p-6">
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
      {googleMapsApiKey ? (
        <LoadScript googleMapsApiKey={googleMapsApiKey} onLoad={() => setMapLoaded(true)}>
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={defaultCenter}
            zoom={15}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: true,
              mapTypeControl: true,
              fullscreenControl: true,
            }}
          >
            {mapLoaded && (
              <Marker position={defaultCenter} onClick={() => setIsInfoWindowOpen(true)} icon={markerIcon}>
                {isInfoWindowOpen && (
                  <InfoWindow position={defaultCenter} onCloseClick={() => setIsInfoWindowOpen(false)}>
                    <div className="p-2">
                      <h3 className="font-bold">ExoDrive</h3>
                      <p className="text-sm">{address}</p>
                    </div>
                  </InfoWindow>
                )}
              </Marker>
            )}
          </GoogleMap>
        </LoadScript>
      ) : (
        <MapFallback />
      )}

      {!mapLoaded && <MapFallback />}
    </div>
  )
}

