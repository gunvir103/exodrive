"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, AlertCircle } from "lucide-react"
import { useHeroContent, type HeroContentData } from "@/contexts/hero-content-context"
import { useTextAnimation } from "@/hooks/use-text-animation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { ParticlesBackground } from "./particles-background"

interface HeroSectionProps {
  // Optional props to override context data
  title?: string
  subtitle?: string
  badgeText?: string
  primaryButtonText?: string
  primaryButtonLink?: string
  secondaryButtonText?: string
  secondaryButtonLink?: string
  // Animation configuration
  animationConfig?: {
    delayOffset?: number
    characterAnimationConfig?: {
      initialY?: number
      initialYRandomRange?: number
      duration?: number
      stiffness?: number
      damping?: number
    }
  }
  // Particles configuration
  particlesConfig?: {
    position?: "top" | "bottom"
    color?: string
    quantity?: number
    speed?: number
    opacity?: number
    height?: string
  }
}

export function HeroSection({
  title: propTitle,
  subtitle: propSubtitle,
  badgeText: propBadgeText,
  primaryButtonText: propPrimaryButtonText,
  primaryButtonLink: propPrimaryButtonLink,
  secondaryButtonText: propSecondaryButtonText,
  secondaryButtonLink: propSecondaryButtonLink,
  animationConfig,
  particlesConfig,
}: HeroSectionProps) {
  const [isGoldSheen, setIsGoldSheen] = useState(false)
  const [hasAutoAnimated, setHasAutoAnimated] = useState(false)
  const heroRef = useRef<HTMLElement>(null)
  const [isMounted, setIsMounted] = useState(false)

  // --- TEMPORARILY BYPASS CONTEXT ---
  // const { heroContent, isLoading, error, refetch } = useHeroContent()
  const isLoading = false; // Assume not loading
  const error = null; // Assume no error
  // --- END TEMPORARY BYPASS ---

  // Use text animation hook with custom configuration
  const { animateText } = useTextAnimation({
    delayOffset: animationConfig?.delayOffset || 0.5,
    characterAnimationConfig: animationConfig?.characterAnimationConfig || {
      initialY: 0,
      initialYRandomRange: 5,
      duration: 0.3,
      stiffness: 120,
      damping: 15,
    },
  })

  // Merge props with context data, with props taking precedence
  // --- USE ONLY PROPS TEMPORARILY ---
  const content: HeroContentData = {
    id: "default", // Default ID
    title: propTitle || "Default Title", // Use prop or fallback
    subtitle: propSubtitle || "Default Subtitle",
    backgroundType: "image", // Set to valid type, src is empty
    backgroundSrc: "",
    badgeText: propBadgeText || "Default Badge",
    primaryButtonText: propPrimaryButtonText || "Browse",
    primaryButtonLink: propPrimaryButtonLink || "#",
    secondaryButtonText: propSecondaryButtonText || "Contact",
    secondaryButtonLink: propSecondaryButtonLink || "#",
    isActive: true, // Assume active
  }
  // --- END USE ONLY PROPS ---

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  })

  // Parallax effects
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const textY = useTransform(scrollYProgress, [0, 0.3], [0, 100])

  // Set mounted state
  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    // Trigger the animation after 3.5 seconds
    const timer = setTimeout(() => {
      setIsGoldSheen(true)

      // Turn off the animation after it completes
      const animationDuration = 1200 // 1.2 seconds
      setTimeout(() => {
        setIsGoldSheen(false)
        setHasAutoAnimated(true)
      }, animationDuration)
    }, 3500)

    return () => clearTimeout(timer)
  }, [])

  // TEMPORARILY SKIPPING Loading and Error states rendering below

  // if (isLoading) { return (...); }
  // if (error) { return (...); }

  return (
    <section ref={heroRef} className="relative h-[90vh] md:h-screen w-full overflow-hidden bg-black">
      {/* Solid black background with subtle gradient */}
      <motion.div style={{ opacity }} className="absolute inset-0 bg-gradient-to-b from-black via-black to-[#0a0a0a]" />

      {/* Gold particles animation - updated configuration */}
      {isMounted && (
        <ParticlesBackground
          position={particlesConfig?.position || "bottom"}
          color={particlesConfig?.color || "#D4AF37"} // Gold color
          quantity={particlesConfig?.quantity || 60} // Increased from 40
          speed={particlesConfig?.speed || 1.2} // Slightly increased
          opacity={particlesConfig?.opacity || 0.4} // Increased from 0.3
          height={particlesConfig?.height || "60%"} // Increased from 40%
        />
      )}

      {/* Add a second particle background at the top for more visual interest */}
      {isMounted && (
        <ParticlesBackground
          position="top"
          color="#D4AF37" // Gold color
          quantity={30} // Fewer particles at the top
          speed={0.8}
          opacity={0.25}
          height="30%"
        />
      )}

      <div className="container relative z-20 flex h-full flex-col items-center justify-center text-white px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          style={{ y: textY }}
          className="max-w-4xl"
        >
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge
              className="mb-6 px-4 py-1.5 text-sm bg-[#D4AF37]/10 backdrop-blur-sm text-[#D4AF37] border-[#D4AF37]/30 relative group overflow-hidden"
              variant="outline"
              onMouseEnter={() => setIsGoldSheen(true)}
              onMouseLeave={() => setIsGoldSheen(false)}
              style={{
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span className="relative z-10">Premium Luxury Cars of The DMV</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent"
                initial={{ x: "-100%" }}
                animate={{
                  x: isGoldSheen || hasAutoAnimated ? "100%" : "-100%",
                }}
                transition={{
                  duration: 1.2,
                  ease: "easeInOut",
                  repeat: isGoldSheen ? Number.POSITIVE_INFINITY : 0,
                  repeatDelay: 0.5,
                }}
              />
            </Badge>
          </motion.div>

          <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl lg:text-7xl text-shadow-lg">
            {animateText(content.title)}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mb-8 max-w-xl mx-auto text-base text-gray-200 md:text-lg lg:text-xl"
          >
            {content.subtitle}
          </motion.p>

          <div className="flex flex-wrap justify-center gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button size="lg" asChild className="bg-[#D4AF37] hover:bg-[#C5A028] text-black font-medium">
                <Link href={content.primaryButtonLink}>{content.primaryButtonText}</Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                size="lg"
                asChild
                variant="outline"
                className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                <a href={content.secondaryButtonLink} target="_blank" rel="noopener noreferrer">
                  {content.secondaryButtonText}
                </a>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-30">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.5 }}
          className="animate-float"
        >
          <Link
            href="#features"
            className="flex flex-col items-center text-white hover:text-[#D4AF37] transition-colors"
          >
            <span className="text-sm mb-2">Scroll to explore</span>
            <ChevronDown className="h-6 w-6" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

