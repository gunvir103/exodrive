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
  // Particles configuration - keeping for backward compatibility
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
  particlesConfig, // Keep for backward compatibility
}: HeroSectionProps) {
  const [isGoldSheen, setIsGoldSheen] = useState(false)
  const [hasAutoAnimated, setHasAutoAnimated] = useState(false)
  const heroRef = useRef<HTMLElement>(null)
  const [isMounted, setIsMounted] = useState(false)

  // --- Restore CONTEXT ---
  const { heroContent, isLoading, error, refetch } = useHeroContent()
  // --- END Restore CONTEXT ---

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
  // --- Restore Context Merging ---
  const content: HeroContentData = {
    id: heroContent?.id || "default",
    title: propTitle || heroContent?.title || "Loading...", // Use prop, then context, then fallback
    subtitle: propSubtitle || heroContent?.subtitle || "Loading...",
    backgroundType: "image", // Keep as image for now, adjust if needed based on context data later
    backgroundSrc: "", // Need to handle backgroundSrc from heroContent if used
    badgeText: propBadgeText || heroContent?.badgeText || "Loading...",
    primaryButtonText: propPrimaryButtonText || heroContent?.primaryButtonText || "Browse",
    primaryButtonLink: propPrimaryButtonLink || heroContent?.primaryButtonLink || "#",
    secondaryButtonText: propSecondaryButtonText || heroContent?.secondaryButtonText || "Contact",
    secondaryButtonLink: propSecondaryButtonLink || heroContent?.secondaryButtonLink || "#",
    isActive: heroContent?.isActive || true,
  }
  // --- END Restore Context Merging ---

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

  // Restore Loading and Error states rendering below

  if (isLoading) {
    // Keep the original loading state JSX here
    return (
      <section ref={heroRef} className="relative h-[90vh] md:h-screen w-full overflow-hidden bg-black">
        <div className="absolute inset-0 bg-muted/10 animate-pulse" />
        <div className="container relative z-10 flex h-full flex-col items-center justify-center px-4 md:px-6 text-center">
          <div className="max-w-4xl">
            <Skeleton className="h-8 w-32 mx-auto mb-6 bg-gray-800" />
            <Skeleton className="h-16 w-full mx-auto mb-4 bg-gray-800" />
            <Skeleton className="h-16 w-3/4 mx-auto mb-6 bg-gray-800" />
            <Skeleton className="h-6 w-1/2 mx-auto mb-8 bg-gray-800" />
            <div className="flex justify-center gap-4">
              <Skeleton className="h-12 w-32 bg-gray-800" />
              <Skeleton className="h-12 w-32 bg-gray-800" />
            </div>
          </div>
        </div>
      </section>
    )
  }
  
  if (error) {
    // Keep the original error state JSX here
    return (
      <section ref={heroRef} className="relative h-[90vh] md:h-screen w-full overflow-hidden bg-black">
        <div className="absolute inset-0 bg-muted/5" />
        <div className="container relative z-10 flex h-full flex-col items-center justify-center px-4 md:px-6">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load hero content. Please refresh the page or try again later.
            </AlertDescription>
          </Alert>
          <Button onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section ref={heroRef} className="relative h-[90vh] md:h-screen w-full overflow-hidden bg-black">
      {/* Solid black background with subtle gradient */}
      <motion.div style={{ opacity }} className="absolute inset-0 bg-gradient-to-b from-black via-black to-[#0a0a0a]" />

      {/* Gold gradient overlay - replacing particles for better performance */}
      {isMounted && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Bottom gold gradient */}
          <div className="absolute bottom-0 w-full h-[60%] bg-gradient-to-t from-[#D4AF37]/10 via-[#D4AF37]/05 to-transparent" />
          
          {/* Top subtle gold gradient */}
          <div className="absolute top-0 w-full h-[30%] bg-gradient-to-b from-[#D4AF37]/05 via-[#D4AF37]/03 to-transparent" />
          
          {/* Add some radial gradient elements for depth */}
          <div className="absolute bottom-0 left-1/4 w-1/2 h-[40%] bg-radial-gradient-gold opacity-20" />
          <div className="absolute top-1/4 right-1/4 w-1/3 h-[30%] bg-radial-gradient-gold opacity-10" />
        </div>
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

