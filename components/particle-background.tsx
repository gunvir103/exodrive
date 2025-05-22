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
  quantity = 60, // Increased from 40
  speed = 1,
  opacity = 0.4, // Increased from 0.3
  height = "60%", // Increased from 40%
}: ParticlesBackgroundProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadFull(engine)
  }, [])

  const particlesLoaded = useCallback(async (container: Container | undefined) => {
    // Container loaded
  }, [])

  if (!mounted) return null

  return (
    <div
      className="absolute w-full pointer-events-none z-10"
      style={{
        [position]: 0,
        height: height,
      }}
    >
      <Particles
        id="tsparticles"
        init={particlesInit}
        loaded={particlesLoaded}
        options={{
          fullScreen: {
            enable: false,
          },
          fpsLimit: 60,
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
              type: ["circle", "polygon"], // Add polygon shape for variety
              polygon: {
                sides: 6, // Hexagon
              },
            },
            opacity: {
              value: opacity,
              random: true,
              anim: {
                enable: true,
                speed: 0.8, // Increased from 0.5
                opacity_min: 0.1,
                sync: false,
              },
            },
            size: {
              value: 4, // Increased from 3
              random: true,
              anim: {
                enable: true,
                speed: 2,
                size_min: 0.1,
                sync: false,
              },
            },
            line_linked: {
              enable: true,
              distance: 150,
              color: color,
              opacity: 0.3, // Increased from 0.2
              width: 1,
            },
            move: {
              enable: true,
              speed: speed,
              direction: position === "top" ? "bottom" : "none", // Changed from "top" to "none" for more random movement
              random: true,
              straight: false,
              out_mode: "out",
              bounce: false,
              attract: {
                enable: true,
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
          retina_detect: true,
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

