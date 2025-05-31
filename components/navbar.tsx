"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Car, Menu, X, Instagram, ChevronRight } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [prevScrollPos, setPrevScrollPos] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.scrollY

      // Determine if we should show or hide the navbar
      if (currentScrollPos > 100) {
        setVisible(prevScrollPos > currentScrollPos || currentScrollPos < 10)
      } else {
        setVisible(true)
      }

      // Determine if the navbar should have background
      setIsScrolled(currentScrollPos > 10)

      setPrevScrollPos(currentScrollPos)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [prevScrollPos])

  const routes = [
    {
      href: "/",
      label: "Home",
      active: pathname === "/",
    },
    {
      href: "/fleet",
      label: "Fleet",
      active: pathname === "/fleet" || pathname.startsWith("/fleet/"),
    },
    {
      href: "/policies",
      label: "Policies",
      active: pathname === "/policies",
    },
    {
      href: "/contact",
      label: "Contact",
      active: pathname === "/contact",
    },
  ]

  const navVariants = {
    hidden: { y: -100, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.2 } }, // Reduced duration
  }

  return (
    <AnimatePresence>
      <motion.header
        variants={navVariants}
        initial="hidden"
        animate={visible ? "visible" : "hidden"}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-200", // Reduced duration
          isScrolled ? "bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#333333]" : "bg-transparent",
        )}
      >
        <div className="container flex h-12 md:h-14 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 z-10">
            <Car className={cn("h-5 w-5", isScrolled || isOpen ? "text-foreground" : "text-white")} />
            <span className={cn("font-medium text-base", isScrolled || isOpen ? "text-foreground" : "text-white")}>
              ExoDrive Exotics
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <NavigationMenu>
              <NavigationMenuList>
                {routes.map((route) => (
                  <NavigationMenuItem key={route.href}>
                    <Link href={route.href} legacyBehavior passHref>
                      <NavigationMenuLink
                        className={cn(
                          "px-3 py-2 text-sm font-medium transition-colors",
                          isScrolled ? "text-gray-300 hover:text-white" : "text-gray-300 hover:text-white",
                          route.active && "text-white",
                        )}
                        onClick={() => {
                          import("@/lib/analytics/track-events").then(({ trackNavigation }) => {
                            trackNavigation(route.label, pathname);
                          });
                        }}
                      >
                        {route.label}
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>

            <Button asChild className="button-apple ml-4">
              <a
                href="https://www.instagram.com/exodriveexotics/?igsh=MTNwNzQ3a3c1a2xieQ%3D%3D#"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="mr-2 h-4 w-4" />
                Rent Now
              </a>
            </Button>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className={!isScrolled && !isOpen ? "text-white" : ""}>
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[350px] p-0 bg-[#0a0a0a]">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between p-4 border-b border-[#333333]">
                    <Link href="/" className="flex items-center space-x-2" onClick={() => setIsOpen(false)}>
                      <Car className="h-5 w-5" />
                      <span className="font-medium text-base">exoDrive</span>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close menu</span>
                    </Button>
                  </div>

                  <nav className="flex-1 overflow-auto py-6 px-4">
                    <div className="space-y-1">
                      {routes.map((route) => (
                        <Link
                          key={route.href}
                          href={route.href}
                          className={cn(
                            "flex items-center justify-between py-2 px-3 rounded-lg transition-colors text-base",
                            route.active
                              ? "bg-[#333333] text-white font-medium"
                              : "text-gray-300 hover:bg-[#333333] hover:text-white",
                          )}
                          onClick={() => {
                            setIsOpen(false);
                            
                            import("@/lib/analytics/track-events").then(({ trackNavigation }) => {
                              trackNavigation(route.label, pathname);
                            });
                          }}
                        >
                          <span>{route.label}</span>
                          <ChevronRight className="h-4 w-4 opacity-50" />
                        </Link>
                      ))}
                    </div>
                  </nav>

                  <div className="p-4 border-t border-[#333333]">
                    <Button asChild className="w-full button-apple">
                      <a
                        href="https://www.instagram.com/exodriveexotics/?igsh=MTNwNzQ3a3c1a2xieQ%3D%3D#"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Instagram className="mr-2 h-4 w-4" />
                        Rent Now
                      </a>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </motion.header>
    </AnimatePresence>
  )
}

