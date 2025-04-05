// This would normally come from a database
export interface Car {
  id: string
  name: string
  description: string
  price: number
  available: boolean
  category: string
  specs: {
    engine: string
    power: string
    acceleration: string
    topSpeed: string
    transmission?: string
    drivetrain?: string
    seats?: number
    fuelType?: string
  }
  features?: string[]
  images: string[]
  featured: boolean
  reviews?: {
    name: string
    rating: number
    date: string
    comment: string
  }[]
}

export const cars: Car[] = [
  {
    id: "lamborghini-huracan",
    name: "Lamborghini Huracán",
    description:
      "Experience the raw power and precision of this Italian masterpiece. The Lamborghini Huracán delivers an unforgettable driving experience with its naturally aspirated V10 engine, producing 610 horsepower and a spine-tingling exhaust note. With its aggressive styling and cutting-edge technology, the Huracán represents the perfect blend of Italian passion and engineering excellence.",
    price: 1200,
    available: true,
    category: "Supercar",
    specs: {
      engine: "5.2L V10",
      power: "610 hp",
      acceleration: "2.9s (0-60 mph)",
      topSpeed: "201 mph",
      transmission: "7-speed dual-clutch",
      drivetrain: "All-wheel drive",
      seats: 2,
      fuelType: "Premium",
    },
    features: [
      "Carbon Ceramic Brakes",
      "Magnetorheological Suspension",
      "Dynamic Steering",
      "Launch Control",
      "Drive Mode Selector",
      "Carbon Fiber Interior Trim",
      "Alcantara Upholstery",
      "Premium Sound System",
    ],
    images: [
      "/placeholder.svg?height=600&width=800&text=Lamborghini+1",
      "/placeholder.svg?height=600&width=800&text=Lamborghini+2",
      "/placeholder.svg?height=600&width=800&text=Lamborghini+3",
      "/placeholder.svg?height=600&width=800&text=Lamborghini+4",
    ],
    featured: true,
    reviews: [
      {
        name: "Alex Johnson",
        rating: 5,
        date: "2023-12-15",
        comment:
          "Incredible experience! The Huracán was everything I dreamed of and more. The power, the sound, the looks - absolutely perfect.",
      },
      {
        name: "Sarah Williams",
        rating: 5,
        date: "2023-11-20",
        comment:
          "Rented this for my husband's birthday and he was thrilled. The service from exoDrive was impeccable from start to finish.",
      },
    ],
  },
  {
    id: "ferrari-488",
    name: "Ferrari 488",
    description:
      "Feel the thrill of Ferrari's legendary performance and style. The Ferrari 488 GTB is a masterpiece of engineering and design, featuring a twin-turbocharged V8 engine that delivers breathtaking acceleration and a top speed that few cars can match. Every detail of this Italian supercar has been crafted to provide the ultimate driving experience.",
    price: 1400,
    available: true,
    category: "Supercar",
    specs: {
      engine: "3.9L Twin-Turbo V8",
      power: "661 hp",
      acceleration: "3.0s (0-60 mph)",
      topSpeed: "205 mph",
      transmission: "7-speed dual-clutch",
      drivetrain: "Rear-wheel drive",
      seats: 2,
      fuelType: "Premium",
    },
    features: [
      "Carbon Ceramic Brakes",
      "Adaptive Suspension",
      "F1-Trac Traction Control",
      "E-Diff3 Electronic Differential",
      "Manettino Dial",
      "Carbon Fiber Racing Seats",
      "JBL Professional Sound System",
      "Ferrari Telemetry System",
    ],
    images: [
      "/placeholder.svg?height=600&width=800&text=Ferrari+1",
      "/placeholder.svg?height=600&width=800&text=Ferrari+2",
      "/placeholder.svg?height=600&width=800&text=Ferrari+3",
    ],
    featured: false,
    reviews: [
      {
        name: "Michael Chen",
        rating: 5,
        date: "2023-10-05",
        comment:
          "The Ferrari 488 is a masterpiece. The turbo engine delivers incredible power and the handling is precise. Worth every penny!",
      },
    ],
  },
  {
    id: "mclaren-720s",
    name: "McLaren 720S",
    description:
      "Cutting-edge technology meets breathtaking design in the McLaren 720S. This British supercar represents the pinnacle of automotive engineering, with a carbon fiber chassis, advanced aerodynamics, and a twin-turbocharged V8 engine that produces an astonishing 710 horsepower. The 720S offers a driving experience that is both exhilarating and refined.",
    price: 1300,
    available: false,
    category: "Supercar",
    specs: {
      engine: "4.0L Twin-Turbo V8",
      power: "710 hp",
      acceleration: "2.8s (0-60 mph)",
      topSpeed: "212 mph",
      transmission: "7-speed dual-clutch",
      drivetrain: "Rear-wheel drive",
      seats: 2,
      fuelType: "Premium",
    },
    features: [
      "Proactive Chassis Control II",
      "Variable Drift Control",
      "Active Dynamics Panel",
      "Folding Driver Display",
      "Dihedral Doors",
      "Carbon Fiber Monocage II",
      "Bowers & Wilkins Audio System",
      "Track Telemetry with Cameras",
    ],
    images: [
      "/placeholder.svg?height=600&width=800&text=McLaren+1",
      "/placeholder.svg?height=600&width=800&text=McLaren+2",
    ],
    featured: false,
    reviews: [],
  },
  {
    id: "aston-martin-vantage",
    name: "Aston Martin Vantage",
    description:
      "British elegance with a powerful heart. The Aston Martin Vantage combines stunning design with exhilarating performance. Its 4.0-liter twin-turbocharged V8 engine delivers 503 horsepower, propelling this sports car from 0-60 mph in just 3.5 seconds. The Vantage offers a perfect balance of luxury, craftsmanship, and driving dynamics.",
    price: 950,
    available: true,
    category: "Sports Car",
    specs: {
      engine: "4.0L Twin-Turbo V8",
      power: "503 hp",
      acceleration: "3.5s (0-60 mph)",
      topSpeed: "195 mph",
      transmission: "8-speed automatic",
      drivetrain: "Rear-wheel drive",
      seats: 2,
      fuelType: "Premium",
    },
    features: [
      "Adaptive Damping System",
      "Electronic Rear Differential",
      "Dynamic Torque Vectoring",
      "Multiple Driving Modes",
      "Premium Audio System",
      "Hand-Stitched Leather Interior",
      "Sports Exhaust System",
      "Carbon Fiber Accents",
    ],
    images: [
      "/placeholder.svg?height=600&width=800&text=Aston+Martin+1",
      "/placeholder.svg?height=600&width=800&text=Aston+Martin+2",
    ],
    featured: false,
    reviews: [
      {
        name: "James Wilson",
        rating: 5,
        date: "2023-09-12",
        comment:
          "The Vantage is the perfect blend of luxury and performance. It turns heads everywhere you go and sounds incredible.",
      },
    ],
  },
  {
    id: "porsche-911-turbo",
    name: "Porsche 911 Turbo",
    description:
      "The iconic sports car that defines precision engineering. The Porsche 911 Turbo is the benchmark for performance, handling, and everyday usability. With its twin-turbocharged flat-six engine producing 572 horsepower, the 911 Turbo delivers breathtaking acceleration and a driving experience that is both thrilling and refined.",
    price: 900,
    available: true,
    category: "Sports Car",
    specs: {
      engine: "3.8L Twin-Turbo Flat-6",
      power: "572 hp",
      acceleration: "2.7s (0-60 mph)",
      topSpeed: "198 mph",
      transmission: "8-speed PDK",
      drivetrain: "All-wheel drive",
      seats: 4,
      fuelType: "Premium",
    },
    features: [
      "Porsche Active Suspension Management",
      "Sport Chrono Package",
      "Rear-Axle Steering",
      "Porsche Ceramic Composite Brakes",
      "Adaptive Sport Seats",
      "Burmester High-End Surround Sound",
      "LED Matrix Headlights",
      "Porsche Torque Vectoring Plus",
    ],
    images: [
      "/placeholder.svg?height=600&width=800&text=Porsche+1",
      "/placeholder.svg?height=600&width=800&text=Porsche+2",
    ],
    featured: false,
    reviews: [
      {
        name: "David Miller",
        rating: 5,
        date: "2023-08-20",
        comment:
          "The 911 Turbo is the perfect daily driver supercar. Comfortable enough for everyday use but with performance that will blow your mind.",
      },
    ],
  },
  {
    id: "bentley-continental-gt",
    name: "Bentley Continental GT",
    description:
      "Luxury grand touring with unmatched comfort and power. The Bentley Continental GT represents the pinnacle of British luxury and craftsmanship. Its W12 engine produces 626 horsepower, propelling this grand tourer from 0-60 mph in just 3.6 seconds. The Continental GT combines breathtaking performance with opulent comfort and cutting-edge technology.",
    price: 1100,
    available: true,
    category: "Luxury",
    specs: {
      engine: "6.0L W12",
      power: "626 hp",
      acceleration: "3.6s (0-60 mph)",
      topSpeed: "207 mph",
      transmission: "8-speed dual-clutch",
      drivetrain: "All-wheel drive",
      seats: 4,
      fuelType: "Premium",
    },
    features: [
      "Bentley Dynamic Ride",
      "Air Suspension with Continuous Damping Control",
      "Rotating Dashboard Display",
      "Naim for Bentley Premium Audio",
      "Hand-Stitched Leather Interior",
      "Massage Seats with Heating and Ventilation",
      "Mood Lighting",
      "Breitling Tourbillon Clock",
    ],
    images: [
      "/placeholder.svg?height=600&width=800&text=Bentley+1",
      "/placeholder.svg?height=600&width=800&text=Bentley+2",
    ],
    featured: false,
    reviews: [
      {
        name: "Elizabeth Parker",
        rating: 5,
        date: "2023-07-15",
        comment:
          "The Continental GT is the ultimate luxury experience. The craftsmanship is unparalleled and the performance is surprising for such a luxurious car.",
      },
    ],
  },
  {
    id: "rolls-royce-wraith",
    name: "Rolls-Royce Wraith",
    description:
      "The ultimate expression of luxury and craftsmanship. The Rolls-Royce Wraith is the most powerful and dynamic Rolls-Royce ever produced. Its twin-turbocharged V12 engine delivers 624 horsepower, propelling this luxury coupe with effortless grace. The Wraith combines timeless elegance with modern technology and uncompromising luxury.",
    price: 1600,
    available: true,
    category: "Luxury",
    specs: {
      engine: "6.6L Twin-Turbo V12",
      power: "624 hp",
      acceleration: "4.4s (0-60 mph)",
      topSpeed: "155 mph",
      transmission: "8-speed automatic",
      drivetrain: "Rear-wheel drive",
      seats: 4,
      fuelType: "Premium",
    },
    features: [
      "Starlight Headliner",
      "Satellite Aided Transmission",
      "Spirit of Ecstasy Rotary Controller",
      "Bespoke Audio System",
      "Hand-Crafted Wood Paneling",
      "Lambswool Floor Mats",
      "Coach Doors",
      "Head-Up Display",
    ],
    images: [
      "/placeholder.svg?height=600&width=800&text=Rolls+Royce+1",
      "/placeholder.svg?height=600&width=800&text=Rolls+Royce+2",
    ],
    featured: true,
    reviews: [
      {
        name: "Robert Thompson",
        rating: 5,
        date: "2023-06-10",
        comment:
          "The Wraith is simply extraordinary. It's like driving a work of art. The attention to detail and the quality of materials is beyond anything I've experienced.",
      },
    ],
  },
]

export function getCar(id: string): Car | undefined {
  return cars.find((car) => car.id === id)
}

export function getRelatedCars(id: string, limit = 3): Car[] {
  const car = getCar(id)
  if (!car) return []

  // First try to get cars of the same category
  let related = cars.filter((c) => c.id !== id && c.category === car.category).slice(0, limit)

  // If we don't have enough cars from the same category, add cars from other categories
  if (related.length < limit) {
    const otherCars = cars.filter((c) => c.id !== id && c.category !== car.category).slice(0, limit - related.length)

    related = [...related, ...otherCars]
  }

  return related
}

export function getFeaturedCars(limit = 4): Car[] {
  return cars.filter((car) => car.featured).slice(0, limit)
}

export function getAvailableCars(): Car[] {
  return cars.filter((car) => car.available)
}

export function getCategories(): string[] {
  return Array.from(new Set(cars.map((car) => car.category)))
}

