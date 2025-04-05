"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Instagram, Search, Filter, X } from "lucide-react"
import { CarCard } from "@/components/car-card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion, AnimatePresence } from "framer-motion"
import { ParticlesBackground } from "@/components/particles-background"
import type { OptimizedCarListItem } from "@/lib/services/car-service-supabase"

// This interface defines the props our client component will receive
interface FleetClientComponentProps {
  // Use the specific optimized type
  initialCars: OptimizedCarListItem[]; 
  initialError: string | null;
}

// The main client component that handles UI interactions
export default function FleetClientComponent({ initialCars, initialError }: FleetClientComponentProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  
  // Use the specific optimized type for state
  const [allCars, setAllCars] = useState<OptimizedCarListItem[]>(initialCars) 
  const [filteredCars, setFilteredCars] = useState<OptimizedCarListItem[]>(initialCars) 
  const [isLoading, setIsLoading] = useState(false); // Only true for client-side actions now
  const [error, setError] = useState<string | null>(initialError); // Initialize with fetched error
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOption, setSortOption] = useState("featured")
  const [showFilters, setShowFilters] = useState(false)

  // Update URL with filters
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    startTransition(() => {
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);
      if (sortOption !== 'featured') params.set('sort', sortOption);
      
      const newPath = pathname + (params.toString() ? `?${params.toString()}` : '');
      router.replace(newPath, { scroll: false });
    });
  }, [selectedCategory, searchQuery, sortOption, pathname, router]);

  // Filter and sort cars - Use fields available in the optimized structure
  const filterAndSortCars = useCallback(() => {
    if (!allCars || allCars.length === 0) {
        setFilteredCars([]); // Ensure filtered cars is empty if allCars is empty
        return;
    }
    
    let result = [...allCars];

    // Apply category filter
    if (selectedCategory) {
      result = result.filter((car) => car.category === selectedCategory);
    }
    // Apply search filter (use available fields: name, shortDescription, category)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (car) =>
          (car.name || "").toLowerCase().includes(query) ||
          (car.shortDescription || "").toLowerCase().includes(query) || 
          (car.category || "").toLowerCase().includes(query)
          // Removed make, model, description as they aren't in the optimized list
      );
    }
    // Apply sorting (use available fields: price_per_day, name, featured)
    switch (sortOption) {
      case "price-asc": result.sort((a, b) => (a.price_per_day ?? 0) - (b.price_per_day ?? 0)); break;
      case "price-desc": result.sort((a, b) => (b.price_per_day ?? 0) - (a.price_per_day ?? 0)); break;
      case "name-asc": result.sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
      case "name-desc": result.sort((a, b) => (b.name || "").localeCompare(a.name || "")); break;
      case "featured": default:
        result.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return (a.name || "").localeCompare(b.name || "");
        });
        break;
    }
    setFilteredCars(result);
  }, [selectedCategory, searchQuery, sortOption, allCars]);

  // Update filtered cars whenever dependencies change
  useEffect(() => {
    filterAndSortCars();
  }, [filterAndSortCars]);

  // Get unique categories from the initially fetched cars
  // Ensure car and car.category exist before mapping
  const categories = Array.from(new Set(allCars?.filter(car => car?.category).map((car) => car.category) || []));

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedCategory(null)
    setSearchQuery("")
    setSortOption("featured")
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }, [pathname, router]);

  // Handle initial error state
  if (error) {
    return <div className="container py-10 text-center text-red-500">Error loading cars: {error}</div>;
  }
  
  // Render the UI using `filteredCars`
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative h-[40vh] md:h-[50vh] w-full overflow-hidden bg-black">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#1a1a1a] to-[#2a2a2a]" />

        <div className="container relative z-10 flex h-full flex-col items-center justify-center text-white px-4 md:px-6 text-center">
          <div className="max-w-4xl">
            <Badge
              className="mb-6 px-4 py-1.5 text-sm bg-white/10 backdrop-blur-sm text-white border-none"
              variant="outline"
            >
              Exotic Collection
            </Badge>
            <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl lg:text-7xl text-shadow-lg">
              Our <span className="text-[#eae2b7]">Luxury</span> Fleet
            </h1>
            <p className="mb-8 max-w-xl mx-auto text-base text-gray-200 md:text-lg lg:text-xl">
              Browse our collection of luxury and exotic cars available for rent in the DMV area
            </p>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="sticky top-0 z-30 py-4 bg-background border-b shadow-sm">
        <div className="container">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden">
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? "Hide Filters" : "Show Filters"}
              </Button>

              <div className="relative hidden md:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search cars..."
                  className="w-full pl-8 md:w-[200px] lg:w-[300px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-2"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={sortOption} onValueChange={setSortOption}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="price-asc">Price: Low to High</SelectItem>
                  <SelectItem value="price-desc">Price: High to Low</SelectItem>
                  <SelectItem value="name-asc">Name: A to Z</SelectItem>
                  <SelectItem value="name-desc">Name: Z to A</SelectItem>
                </SelectContent>
              </Select>

              {(selectedCategory || searchQuery) && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Mobile search */}
          {showFilters && (
            <div className="mt-4 md:hidden">
              <div className="relative mb-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search cars..."
                  className="w-full pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-2"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Category filters */}
          <div
            className={`flex flex-wrap items-center justify-center gap-2 mt-4 ${showFilters ? "block" : "hidden md:flex"}`}
          >
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              className="rounded-full"
              size="sm"
            >
              All Cars
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="rounded-full"
                size="sm"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Car Grid Section */}
      <section className="container py-12">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredCars && filteredCars.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {filteredCars.map((car, index) => (
              <CarCard key={car.id || index} car={car} index={index} />
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            {initialCars && initialCars.length > 0 
              ? "No cars match your current filters."
              : "No cars available at the moment."}
          </div>
        )}
      </section>

      {/* Instagram Section */}
      <section className="py-16 bg-gradient-to-r from-gray-900 via-black to-gray-900">
        <div className="container text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Follow Us on Instagram
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Get a glimpse of our stunning fleet and exclusive behind-the-scenes content.
          </p>
          <Button asChild size="lg" className="bg-[#E1306C] hover:bg-[#c12a5b] text-white">
            <Link href="https://www.instagram.com/exodriveexotics/?igsh=MTNwNzQ3a3c1a2xieQ%3D%3D" target="_blank">
              <Instagram className="mr-2 h-5 w-5" />
              Follow @exodriveexotics
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
} 