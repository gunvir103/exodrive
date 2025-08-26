'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, Grid, List, ChevronDown, Loader2, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { CarCard } from '@/components/car-card'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'

interface CarData {
  id: string
  slug: string
  name: string
  category: string
  shortDescription: string
  available: boolean
  featured: boolean
  created_at: string
  primary_image_url: string
  price_per_day: number
  features: string[]
}

interface CarsResponse {
  success: boolean
  cars: CarData[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: {
    search: string
    category: string
    minPrice: number | null
    maxPrice: number | null
    features: string[]
    sortBy: string
    sortOrder: string
  }
}

interface FiltersState {
  search: string
  category: string
  minPrice: number | null
  maxPrice: number | null
  features: string[]
  sortBy: string
  sortOrder: string
  page: number
}

interface CarBrowsingClientProps {
  initialFilters: FiltersState
}

const CATEGORIES = [
  'SUV',
  'Sedan',
  'Sports',
  'Luxury',
  'Exotic',
  'Convertible',
  'Coupe',
  'Electric'
]

const COMMON_FEATURES = [
  'GPS',
  'Bluetooth',
  'Leather Seats',
  'Sunroof',
  'All-Wheel Drive',
  'Premium Audio',
  'Navigation',
  'Backup Camera',
  'Heated Seats',
  'Keyless Entry'
]

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured First' },
  { value: 'price', label: 'Price' },
  { value: 'name', label: 'Name' },
]

export function CarBrowsingClient({ initialFilters }: CarBrowsingClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [filters, setFilters] = useState<FiltersState>(initialFilters)
  const [cars, setCars] = useState<CarData[]>([])
  const [pagination, setPagination] = useState<CarsResponse['pagination'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000])
  const [maxPriceLimit, setMaxPriceLimit] = useState(2000)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Debounce search input
  const debouncedSearch = useDebounce(filters.search, 500)

  // Update URL when filters change
  const updateURL = useCallback((newFilters: FiltersState) => {
    const params = new URLSearchParams()
    
    if (newFilters.search) params.set('search', newFilters.search)
    if (newFilters.category) params.set('category', newFilters.category)
    if (newFilters.minPrice) params.set('minPrice', newFilters.minPrice.toString())
    if (newFilters.maxPrice) params.set('maxPrice', newFilters.maxPrice.toString())
    if (newFilters.features.length > 0) params.set('features', newFilters.features.join(','))
    if (newFilters.sortBy !== 'featured') params.set('sortBy', newFilters.sortBy)
    if (newFilters.sortOrder !== 'desc') params.set('sortOrder', newFilters.sortOrder)
    if (newFilters.page > 1) params.set('page', newFilters.page.toString())

    const newUrl = params.toString() ? `?${params.toString()}` : '/cars'
    router.replace(newUrl, { scroll: false })
  }, [router])

  // Fetch cars from API
  const fetchCars = useCallback(async (filtersToUse: FiltersState) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      if (filtersToUse.search) params.set('search', filtersToUse.search)
      if (filtersToUse.category) params.set('category', filtersToUse.category)
      if (filtersToUse.minPrice !== null) params.set('minPrice', filtersToUse.minPrice.toString())
      if (filtersToUse.maxPrice !== null) params.set('maxPrice', filtersToUse.maxPrice.toString())
      if (filtersToUse.features.length > 0) params.set('features', filtersToUse.features.join(','))
      params.set('sortBy', filtersToUse.sortBy)
      params.set('sortOrder', filtersToUse.sortOrder)
      params.set('page', filtersToUse.page.toString())
      params.set('limit', '12')

      const response = await fetch(`/api/cars?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch cars')
      }

      const data: CarsResponse = await response.json()
      
      if (data.success) {
        setCars(data.cars)
        setPagination(data.pagination)
        
        // Update price range max if we have cars
        if (data.cars.length > 0) {
          const maxPrice = Math.max(...data.cars.map(car => car.price_per_day || 0))
          if (maxPrice > maxPriceLimit) {
            setMaxPriceLimit(Math.ceil(maxPrice / 100) * 100) // Round up to nearest 100
          }
        }
      } else {
        throw new Error('API returned error')
      }
    } catch (error) {
      console.error('Error fetching cars:', error)
      toast({
        title: "Error",
        description: "Failed to load cars. Please try again.",
        variant: "destructive",
      })
      setCars([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [maxPriceLimit, toast])

  // Effect to fetch cars when filters change
  useEffect(() => {
    const updatedFilters = { ...filters, search: debouncedSearch }
    fetchCars(updatedFilters)
    updateURL(updatedFilters)
  }, [debouncedSearch, filters.category, filters.minPrice, filters.maxPrice, filters.features, filters.sortBy, filters.sortOrder, filters.page, fetchCars, updateURL])

  // Handle filter changes
  const handleFilterChange = useCallback((key: keyof FiltersState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1 // Reset page when other filters change
    }))
  }, [])

  const handlePriceRangeChange = useCallback((value: [number, number]) => {
    setPriceRange(value)
    handleFilterChange('minPrice', value[0] > 0 ? value[0] : null)
    handleFilterChange('maxPrice', value[1] < maxPriceLimit ? value[1] : null)
  }, [maxPriceLimit, handleFilterChange])

  const handleFeatureToggle = useCallback((feature: string) => {
    setFilters(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature],
      page: 1
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      category: '',
      minPrice: null,
      maxPrice: null,
      features: [],
      sortBy: 'featured',
      sortOrder: 'desc',
      page: 1
    })
    setPriceRange([0, maxPriceLimit])
  }, [maxPriceLimit])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.search) count++
    if (filters.category) count++
    if (filters.minPrice !== null || filters.maxPrice !== null) count++
    if (filters.features.length > 0) count++
    return count
  }, [filters])

  const FiltersPanel = () => (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Category</Label>
        <Select 
          value={filters.category} 
          onValueChange={(value) => handleFilterChange('category', value === 'all' ? '' : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price Range */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Price Range: ${priceRange[0]} - ${priceRange[1] >= maxPriceLimit ? `${maxPriceLimit}+` : priceRange[1]} per day
        </Label>
        <Slider
          value={priceRange}
          onValueChange={handlePriceRangeChange}
          max={maxPriceLimit}
          min={0}
          step={50}
          className="w-full"
        />
      </div>

      {/* Features */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Features</Label>
        <div className="space-y-2">
          {COMMON_FEATURES.map((feature) => (
            <div key={feature} className="flex items-center space-x-2">
              <Checkbox
                id={feature}
                checked={filters.features.includes(feature)}
                onCheckedChange={() => handleFeatureToggle(feature)}
              />
              <Label htmlFor={feature} className="text-sm">
                {feature}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {activeFiltersCount > 0 && (
        <Button variant="outline" onClick={clearFilters} className="w-full">
          Clear Filters ({activeFiltersCount})
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Filters Sidebar - Desktop */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Filter className="mr-2 h-5 w-5" />
              Filters
            </h3>
            <FiltersPanel />
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Search and Controls */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cars by name or description..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Controls Row */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile Filters */}
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filters
                    {activeFiltersCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Filter Cars</SheetTitle>
                    <SheetDescription>
                      Use these filters to find your perfect car
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <FiltersPanel />
                  </div>
                </SheetContent>
              </Sheet>

              {/* Active Filters */}
              {activeFiltersCount > 0 && (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  <Badge variant="secondary">{activeFiltersCount}</Badge>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              {/* Sort */}
              <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Mode */}
              <div className="flex rounded-md border">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {/* Results Summary */}
          {pagination && (
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.limit) + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} cars
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="space-y-4">
              <div className={viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' 
                : 'space-y-4'
              }>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-48 w-full mb-4" />
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Cars Grid/List */}
          {!loading && cars.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${filters.search}-${filters.category}-${filters.sortBy}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={viewMode === 'grid' 
                  ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' 
                  : 'space-y-4'
                }
              >
                {cars.map((car, index) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    index={index}
                    variant={viewMode === 'list' ? 'compact' : 'default'}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {/* No Results */}
          {!loading && cars.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="text-muted-foreground mb-4">
                <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No cars found</h3>
                <p>Try adjusting your search criteria or filters.</p>
              </div>
              <Button variant="outline" onClick={clearFilters}>
                Clear all filters
              </Button>
            </motion.div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 pt-8">
              <Button
                variant="outline"
                disabled={!pagination.hasPrev}
                onClick={() => handleFilterChange('page', Math.max(1, filters.page - 1))}
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = i + 1
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === pagination.page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleFilterChange('page', pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                disabled={!pagination.hasNext}
                onClick={() => handleFilterChange('page', filters.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}