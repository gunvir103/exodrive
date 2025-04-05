// Car data types for modular components

// Updated Car interface based on AppCar from car-service-supabase
export interface Car {
  id: string
  slug: string
  name: string
  make?: string;       // Added
  model?: string;      // Added
  year?: number;       // Added
  category: string
  description?: string // Changed from required to optional
  shortDescription?: string
  pricePerDay: number; // Added (replacing pricing object)
  depositAmount?: number;// Added (replacing pricing object)
  engine?: string;     // Added
  horsepower?: number; // Added
  acceleration060?: number; // Added
  topSpeed?: number;   // Added
  transmission?: string; // Added
  drivetrain?: string;   // Added
  features?: Record<string, any>; // Changed from CarFeature[] to JSONB structure
  specifications?: Record<string, any>; // Changed from CarSpecification[] to JSONB structure
  imageUrls?: string[]; // Changed from images: CarImage[]
  isAvailable: boolean; // Renamed from available
  isFeatured: boolean;  // Renamed from featured
  isHidden: boolean;    // Renamed from hidden
  createdAt: Date;      // Changed from string to Date
  updatedAt: Date;      // Changed from string to Date
}

// Admin action types - NOTE: These might need updating later
// as they reference old types like CarImage, CarSpecification etc.
/*
export type CarUpdateAction =
  | { type: "UPDATE_BASIC_INFO"; payload: Partial<Car> }
  | { type: "ADD_IMAGE"; payload: Omit<CarImage, "id"> }
  | { type: "UPDATE_IMAGE"; payload: CarImage }
  | { type: "DELETE_IMAGE"; payload: string }
  | { type: "SET_PRIMARY_IMAGE"; payload: string }
  | { type: "REORDER_IMAGES"; payload: string[] }
  | { type: "ADD_SPECIFICATION"; payload: Omit<CarSpecification, "id"> }
  | { type: "UPDATE_SPECIFICATION"; payload: CarSpecification }
  | { type: "DELETE_SPECIFICATION"; payload: string }
  | { type: "ADD_FEATURE"; payload: Omit<CarFeature, "id"> }
  | { type: "UPDATE_FEATURE"; payload: CarFeature }
  | { type: "DELETE_FEATURE"; payload: string }
  | { type: "ADD_REVIEW"; payload: Omit<CarReview, "id"> }
  | { type: "UPDATE_REVIEW"; payload: CarReview }
  | { type: "DELETE_REVIEW"; payload: string }
  | { type: "UPDATE_PRICING"; payload: Partial<CarPricing> }
  | { type: "UPDATE_AVAILABILITY"; payload: DateAvailability[] }
  | { type: "SET_DATE_STATUS"; payload: { date: string; status: DateAvailability["status"] } }
*/

