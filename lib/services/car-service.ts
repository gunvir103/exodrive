import { v4 as uuidv4 } from "uuid"
import type { Car, DateAvailability, CarUpdateAction } from "../types/car"

// Mock database - in a real app, this would be replaced with API calls
let carsData: Car[] = []

// Initialize with data from cars.ts
import { cars as initialCars } from "../cars"

// Convert the existing cars data to our new format
const initializeData = () => {
  if (carsData.length === 0) {
    carsData = initialCars.map((car) => ({
      id: car.id,
      slug: car.id,
      name: car.name,
      description: car.description,
      shortDescription: car.description.substring(0, 120) + "...",
      category: car.category,
      available: car.available,
      featured: car.featured,
      hidden: false,
      images: car.images.map((url, index) => ({
        id: uuidv4(),
        url,
        alt: `${car.name} view ${index + 1}`,
        isPrimary: index === 0,
        sortOrder: index,
      })),
      specifications: Object.entries(car.specs).map(([name, value]) => ({
        id: uuidv4(),
        name: formatSpecName(name),
        value: String(value),
        isHighlighted: ["engine", "power", "acceleration", "topSpeed"].includes(name),
      })),
      features: (car.features || []).map((feature) => ({
        id: uuidv4(),
        name: feature,
        isHighlighted: false,
      })),
      reviews: (car.reviews || []).map((review) => ({
        id: uuidv4(),
        name: review.name,
        rating: review.rating,
        date: review.date,
        comment: review.comment,
        isVerified: true,
        isApproved: true,
      })),
      pricing: {
        id: uuidv4(),
        basePrice: car.price,
        currency: "USD",
        depositAmount: Math.round(car.price * 0.3),
        minimumDays: 1,
        additionalFees: [
          {
            id: uuidv4(),
            name: "Insurance",
            amount: 50,
            isOptional: false,
            description: "Mandatory insurance coverage",
          },
          {
            id: uuidv4(),
            name: "Delivery",
            amount: 100,
            isOptional: true,
            description: "Delivery to your location",
          },
        ],
      },
      availability: generateMockAvailability(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  }
}

// Helper function to format specification names
function formatSpecName(name: string): string {
  // Convert camelCase to Title Case with spaces
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
}

// Generate mock availability data for the next 30 days
function generateMockAvailability(): DateAvailability[] {
  const availability: DateAvailability[] = []
  const today = new Date()

  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)

    // Randomly mark some dates as booked or maintenance
    const random = Math.random()
    let status: DateAvailability["status"] = "available"

    if (random < 0.1) {
      status = "maintenance"
    } else if (random < 0.3) {
      status = "booked"
    }

    availability.push({
      date: date.toISOString().split("T")[0],
      status,
    })
  }

  return availability
}

// Initialize data
initializeData()

// CRUD operations
export const CarService = {
  // Get all cars
  getAllCars: (): Car[] => {
    return carsData
  },

  // Get visible cars (not hidden)
  getVisibleCars: (): Car[] => {
    return carsData.filter((car) => !car.hidden)
  },

  // Get featured cars
  getFeaturedCars: (limit?: number): Car[] => {
    const featured = carsData.filter((car) => car.featured && !car.hidden)
    return limit ? featured.slice(0, limit) : featured
  },

  // Get car by ID
  getCarById: (id: string): Car | undefined => {
    return carsData.find((car) => car.id === id)
  },

  // Get car by slug
  getCarBySlug: (slug: string): Car | undefined => {
    return carsData.find((car) => car.slug === slug)
  },

  // Create new car
  createCar: (carData: Omit<Car, "id" | "createdAt" | "updatedAt">): Car => {
    const newCar: Car = {
      ...carData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    carsData.push(newCar)
    return newCar
  },

  // Update car
  updateCar: (id: string, updates: Partial<Car>): Car | undefined => {
    const index = carsData.findIndex((car) => car.id === id)
    if (index === -1) return undefined

    carsData[index] = {
      ...carsData[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    return carsData[index]
  },

  // Delete car
  deleteCar: (id: string): boolean => {
    const initialLength = carsData.length
    carsData = carsData.filter((car) => car.id !== id)
    return carsData.length < initialLength
  },

  // Process car update actions
  processCarAction: (carId: string, action: CarUpdateAction): Car | undefined => {
    const carIndex = carsData.findIndex((car) => car.id === carId)
    if (carIndex === -1) return undefined

    const car = { ...carsData[carIndex] }

    switch (action.type) {
      case "UPDATE_BASIC_INFO":
        Object.assign(car, action.payload)
        break

      case "ADD_IMAGE":
        car.images.push({
          id: uuidv4(),
          ...action.payload,
          sortOrder: car.images.length,
        })
        break

      case "UPDATE_IMAGE":
        car.images = car.images.map((img) => (img.id === action.payload.id ? action.payload : img))
        break

      case "DELETE_IMAGE":
        car.images = car.images.filter((img) => img.id !== action.payload)
        // Ensure we still have a primary image
        if (car.images.length > 0 && !car.images.some((img) => img.isPrimary)) {
          car.images[0].isPrimary = true
        }
        break

      case "SET_PRIMARY_IMAGE":
        car.images = car.images.map((img) => ({
          ...img,
          isPrimary: img.id === action.payload,
        }))
        break

      case "REORDER_IMAGES":
        const imageOrder = action.payload
        car.images = car.images
          .sort((a, b) => {
            const aIndex = imageOrder.indexOf(a.id)
            const bIndex = imageOrder.indexOf(b.id)
            return aIndex - bIndex
          })
          .map((img, index) => ({
            ...img,
            sortOrder: index,
          }))
        break

      case "ADD_SPECIFICATION":
        car.specifications.push({
          id: uuidv4(),
          ...action.payload,
        })
        break

      case "UPDATE_SPECIFICATION":
        car.specifications = car.specifications.map((spec) => (spec.id === action.payload.id ? action.payload : spec))
        break

      case "DELETE_SPECIFICATION":
        car.specifications = car.specifications.filter((spec) => spec.id !== action.payload)
        break

      case "ADD_FEATURE":
        car.features.push({
          id: uuidv4(),
          ...action.payload,
        })
        break

      case "UPDATE_FEATURE":
        car.features = car.features.map((feature) => (feature.id === action.payload.id ? action.payload : feature))
        break

      case "DELETE_FEATURE":
        car.features = car.features.filter((feature) => feature.id !== action.payload)
        break

      case "ADD_REVIEW":
        car.reviews.push({
          id: uuidv4(),
          ...action.payload,
        })
        break

      case "UPDATE_REVIEW":
        car.reviews = car.reviews.map((review) => (review.id === action.payload.id ? action.payload : review))
        break

      case "DELETE_REVIEW":
        car.reviews = car.reviews.filter((review) => review.id !== action.payload)
        break

      case "UPDATE_PRICING":
        car.pricing = {
          ...car.pricing,
          ...action.payload,
        }
        break

      case "UPDATE_AVAILABILITY":
        car.availability = action.payload
        break

      case "SET_DATE_STATUS":
        const { date, status } = action.payload
        const existingDateIndex = car.availability.findIndex((a) => a.date === date)

        if (existingDateIndex >= 0) {
          car.availability[existingDateIndex].status = status
        } else {
          car.availability.push({ date, status })
        }
        break
    }

    car.updatedAt = new Date().toISOString()
    carsData[carIndex] = car

    return car
  },

  // Get categories
  getCategories: (): string[] => {
    return Array.from(new Set(carsData.map((car) => car.category)))
  },

  // Get related cars
  getRelatedCars: (carId: string, limit = 3): Car[] => {
    const car = carsData.find((c) => c.id === carId)
    if (!car) return []

    // First try to get cars of the same category
    let related = carsData.filter((c) => c.id !== carId && c.category === car.category && !c.hidden).slice(0, limit)

    // If we don't have enough cars from the same category, add cars from other categories
    if (related.length < limit) {
      const otherCars = carsData
        .filter((c) => c.id !== carId && c.category !== car.category && !c.hidden)
        .slice(0, limit - related.length)

      related = [...related, ...otherCars]
    }

    return related
  },
}

