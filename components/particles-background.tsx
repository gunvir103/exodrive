"use client"

import { useCallback, useEffect, useState } from "react"
import Particles from "react-tsparticles"
import { loadFull } from "tsparticles"
import type { Container, Engine } from "tsparticles-engine"

interface ParticlesBackgroundProps {
  position?: "top" | "bottom"
  color?: string
  quantity?: number
  speed?: number
  opacity?: number
  height?: string
}

export function ParticlesBackground({
  position = "bottom",
  color = "#D4AF37", // Gold color
  quantity = 40, // Reduced for better performance
  speed = 1,
  opacity = 0.4,
  height = "60%",
}: ParticlesBackgroundProps) {
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Safety timeout - if particles don't load in 3 seconds, show a fallback
    const timeout = setTimeout(() => {
      setError(true)
    }, 3000)
    
    return () => clearTimeout(timeout)
  }, [])

  const particlesInit = useCallback(async (engine: Engine) => {
    try {
      await loadFull(engine)
    } catch (err) {
      console.error("Failed to initialize particles:", err)
      setError(true)
    }
  }, [])

  const particlesLoaded = useCallback(async (container: Container | undefined) => {
    if (container) {
      // Clear the error state if we successfully loaded the container
      setError(false)
    }
  }, [])

  if (!mounted) return null
  
  // Fallback to simple gradient if particles fail to load
  if (error) {
    return (
      <div
        className="absolute w-full pointer-events-none z-10"
        style={{
          [position]: 0,
          height: height,
          background: position === "bottom" 
            ? `linear-gradient(to top, ${color}20, transparent)`
            : `linear-gradient(to bottom, ${color}20, transparent)`,
        }}
      />
    )
  }

  return (
    <div
      className="absolute w-full pointer-events-none z-10"
      style={{
        [position]: 0,
        height: height,
      }}
    >
      <Particles
        id={`tsparticles-${position}`} // Unique ID for each instance
        init={particlesInit}
        loaded={particlesLoaded}
        options={{
          fullScreen: {
            enable: false,
          },
          fpsLimit: 30, // Lower for better performance
          particles: {
            number: {
              value: quantity,
              density: {
                enable: true,
                value_area: 800,
              },
            },
            color: {
              value: color,
            },
            shape: {
              type: "circle", // Simplify to just circles for better performance
            },
            opacity: {
              value: opacity,
              random: true,
              anim: {
                enable: true,
                speed: 0.5,
                opacity_min: 0.1,
                sync: false,
              },
            },
            size: {
              value: 3,
              random: true,
              anim: {
                enable: true,
                speed: 1,
                size_min: 0.1,
                sync: false,
              },
            },
            line_linked: {
              enable: true,
              distance: 150,
              color: color,
              opacity: 0.2,
              width: 1,
            },
            move: {
              enable: true,
              speed: speed,
              direction: position === "top" ? "bottom" : "none",
              random: true,
              straight: false,
              out_mode: "out",
              bounce: false,
              attract: {
                enable: false, // Disable for performance
                rotateX: 600,
                rotateY: 1200,
              },
            },
          },
          interactivity: {
            detect_on: "canvas",
            events: {
              onhover: {
                enable: true,
                mode: "grab",
              },
              onclick: {
                enable: false,
              },
              resize: true,
            },
            modes: {
              grab: {
                distance: 140,
                line_linked: {
                  opacity: 0.5,
                },
              },
            },
          },
          retina_detect: false, // Disable for performance
          background: {
            color: "transparent",
            image: "",
            position: "50% 50%",
            repeat: "no-repeat",
            size: "cover",
          },
        }}
      />
    </div>
  )
}

