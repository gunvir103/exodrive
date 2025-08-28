/**
 * Safe Structured Data Schema Generators for ExoDrive
 * JSON-LD schema markup for enhanced SEO and rich snippets with comprehensive error handling
 */

import React from 'react'
import type { Car } from '@/lib/types/car'
import type { AppCar } from '@/lib/services/car-service-supabase'
import { SEO_CONFIG } from './metadata'

// Error handling utilities
interface SchemaError {
  message: string
  context: string
  timestamp: Date
}

function logSchemaError(error: SchemaError) {
  if (typeof window === 'undefined') {
    // Server-side logging
    console.error('[Structured Data Error]', {
      message: error.message,
      context: error.context,
      timestamp: error.timestamp.toISOString(),
    })
  } else {
    // Client-side logging (silent)
    console.debug('[Structured Data Error]', error)
  }
}

// Safe value extraction with fallbacks
function safeString(value: any, fallback: string = ''): string {
  try {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
  } catch {
    return fallback
  }
}

function safeNumber(value: any, fallback: number = 0): number {
  try {
    const num = typeof value === 'string' ? parseFloat(value) : Number(value)
    return isFinite(num) ? num : fallback
  } catch {
    return fallback
  }
}

function safeArray<T>(value: any, fallback: T[] = []): T[] {
  try {
    return Array.isArray(value) ? value : fallback
  } catch {
    return fallback
  }
}

function safeUrl(url: any, baseUrl: string = 'https://www.exodrive.co'): string {
  try {
    if (!url) return `${baseUrl}/placeholder.jpg`
    if (typeof url === 'string') {
      // If it's already a full URL, return it
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }
      // If it's a relative path, make it absolute
      return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`
    }
    return `${baseUrl}/placeholder.jpg`
  } catch {
    return `${baseUrl}/placeholder.jpg`
  }
}

// Base schema types
export interface BaseSchema {
  '@context': string
  '@type': string
}

export interface OrganizationSchema extends BaseSchema {
  '@type': 'Organization'
  name: string
  alternateName?: string
  url: string
  logo: string
  description: string
  contactPoint: ContactPoint[]
  address: PostalAddress
  sameAs: string[]
  foundingDate?: string
  numberOfEmployees?: string
  email: string
  telephone: string
}

export interface LocalBusinessSchema extends BaseSchema {
  '@type': 'LocalBusiness'
  name: string
  image: string[]
  '@id': string
  url: string
  telephone: string
  email: string
  address: PostalAddress
  geo: GeoCoordinates
  openingHoursSpecification: OpeningHours[]
  priceRange: string
  servesCuisine?: string
  aggregateRating?: AggregateRating
  review?: Review[]
  paymentAccepted: string
  currenciesAccepted: string
  areaServed: Place[]
  serviceType: string[]
}

export interface ProductSchema extends BaseSchema {
  '@type': 'Product'
  name: string
  image: string[]
  description: string
  sku?: string
  mpn?: string
  brand: Brand
  category: string
  offers: Offer
  aggregateRating?: AggregateRating
  review?: Review[]
  additionalProperty?: PropertyValue[]
  model?: string
  manufacturer?: Organization
}

export interface BreadcrumbListSchema extends BaseSchema {
  '@type': 'BreadcrumbList'
  itemListElement: ListItem[]
}

export interface FAQPageSchema extends BaseSchema {
  '@type': 'FAQPage'
  mainEntity: Question[]
}

// Supporting types
interface ContactPoint {
  '@type': 'ContactPoint'
  telephone: string
  email?: string
  contactType: string
  availableLanguage: string[]
  areaServed: string[]
  hoursAvailable?: OpeningHours[]
}

interface PostalAddress {
  '@type': 'PostalAddress'
  streetAddress: string
  addressLocality: string
  addressRegion: string
  postalCode: string
  addressCountry: string
}

interface GeoCoordinates {
  '@type': 'GeoCoordinates'
  latitude: number
  longitude: number
}

interface OpeningHours {
  '@type': 'OpeningHoursSpecification'
  dayOfWeek: string[]
  opens: string
  closes: string
}

interface Place {
  '@type': 'Place'
  name: string
}

interface Brand {
  '@type': 'Brand'
  name: string
}

interface Organization {
  '@type': 'Organization'
  name: string
}

interface Offer {
  '@type': 'Offer'
  price?: string
  priceCurrency: string
  availability: string
  priceValidUntil?: string
  url?: string
  seller?: Organization
  priceSpecification?: PriceSpecification
}

interface PriceSpecification {
  '@type': 'PriceSpecification'
  price: string
  priceCurrency: string
  unitCode: string
  unitText: string
}

interface AggregateRating {
  '@type': 'AggregateRating'
  ratingValue: number
  bestRating: number
  worstRating: number
  ratingCount: number
  reviewCount: number
}

interface Review {
  '@type': 'Review'
  reviewRating: Rating
  author: Person
  datePublished: string
  reviewBody?: string
  name?: string
}

interface Rating {
  '@type': 'Rating'
  ratingValue: number
  bestRating: number
  worstRating: number
}

interface Person {
  '@type': 'Person'
  name: string
}

interface PropertyValue {
  '@type': 'PropertyValue'
  name: string
  value: string
}

interface ListItem {
  '@type': 'ListItem'
  position: number
  name: string
  item: string
}

interface Question {
  '@type': 'Question'
  name: string
  acceptedAnswer: Answer
}

interface Answer {
  '@type': 'Answer'
  text: string
}

// Safe Organization Schema Generator
export function generateOrganizationSchema(): OrganizationSchema | null {
  try {
    return generateOrganizationSchemaUnsafe()
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in organization schema',
      context: 'generateOrganizationSchema',
      timestamp: new Date(),
    })
    return null
  }
}

// Internal unsafe version for actual generation
function generateOrganizationSchemaUnsafe(): OrganizationSchema {
  const baseUrl = safeString(SEO_CONFIG?.BRAND?.url, 'https://www.exodrive.co')
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: safeString(SEO_CONFIG?.BUSINESS?.name, 'ExoDrive LLC'),
    alternateName: safeString(SEO_CONFIG?.BRAND?.fullName, 'ExoDrive Exotic Car Rentals'),
    url: baseUrl,
    logo: safeUrl('/logo-512.png', baseUrl),
    description: safeString(SEO_CONFIG?.BRAND?.description, 'Premium luxury and exotic car rental service'),
    email: safeString(SEO_CONFIG?.BUSINESS?.email, 'contact@exodrive.co'),
    telephone: safeString(SEO_CONFIG?.BUSINESS?.phone, '(301) 300-4609'),
    foundingDate: '2020-01-01',
    numberOfEmployees: '10-50',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: safeString(SEO_CONFIG?.BUSINESS?.phone, '(301) 300-4609'),
        email: safeString(SEO_CONFIG?.BUSINESS?.email, 'contact@exodrive.co'),
        contactType: 'customer service',
        availableLanguage: ['English'],
        areaServed: ['US-DC', 'US-MD', 'US-VA'],
        hoursAvailable: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '09:00',
            closes: '19:00',
          },
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Saturday'],
            opens: '10:00',
            closes: '17:00',
          },
        ],
      },
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: safeString(SEO_CONFIG?.BUSINESS?.address?.street, '1201 Seven Locks Rd, Suite 360'),
      addressLocality: safeString(SEO_CONFIG?.BUSINESS?.address?.city, 'Rockville'),
      addressRegion: safeString(SEO_CONFIG?.BUSINESS?.address?.state, 'MD'),
      postalCode: safeString(SEO_CONFIG?.BUSINESS?.address?.zipCode, '20854'),
      addressCountry: safeString(SEO_CONFIG?.BUSINESS?.address?.country, 'US'),
    },
    sameAs: [
      safeString(SEO_CONFIG?.SOCIAL?.instagram, 'https://instagram.com/exodrivexotics'),
      safeString(SEO_CONFIG?.SOCIAL?.facebook, 'https://facebook.com/exodrive'),
      safeString(SEO_CONFIG?.SOCIAL?.twitter, 'https://twitter.com/exodrive'),
      safeString(SEO_CONFIG?.SOCIAL?.youtube, 'https://youtube.com/@exodrive'),
    ].filter(Boolean),
  }
}

// Safe Local Business Schema Generator
export function generateLocalBusinessSchema(aggregateRating?: {
  ratingValue: number
  ratingCount: number
}): LocalBusinessSchema | null {
  try {
    return generateLocalBusinessSchemaUnsafe(aggregateRating)
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in local business schema',
      context: 'generateLocalBusinessSchema',
      timestamp: new Date(),
    })
    return null
  }
}

// Internal unsafe version for actual generation
function generateLocalBusinessSchemaUnsafe(aggregateRating?: {
  ratingValue: number
  ratingCount: number
}): LocalBusinessSchema {
  const baseUrl = safeString(SEO_CONFIG?.BRAND?.url, 'https://www.exodrive.co')
  
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: safeString(SEO_CONFIG?.BRAND?.fullName, 'ExoDrive Exotic Car Rentals'),
    image: [
      safeUrl('/images/showroom-1.jpg', baseUrl),
      safeUrl('/images/showroom-2.jpg', baseUrl),
      safeUrl('/images/fleet-collection.jpg', baseUrl),
    ],
    '@id': baseUrl,
    url: baseUrl,
    telephone: safeString(SEO_CONFIG?.BUSINESS?.phone, '(301) 300-4609'),
    email: safeString(SEO_CONFIG?.BUSINESS?.email, 'contact@exodrive.co'),
    address: {
      '@type': 'PostalAddress',
      streetAddress: safeString(SEO_CONFIG?.BUSINESS?.address?.street, '1201 Seven Locks Rd, Suite 360'),
      addressLocality: safeString(SEO_CONFIG?.BUSINESS?.address?.city, 'Rockville'),
      addressRegion: safeString(SEO_CONFIG?.BUSINESS?.address?.state, 'MD'),
      postalCode: safeString(SEO_CONFIG?.BUSINESS?.address?.zipCode, '20854'),
      addressCountry: safeString(SEO_CONFIG?.BUSINESS?.address?.country, 'US'),
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 39.0909, // Approximate coordinates for Rockville, MD
      longitude: -77.1481,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '19:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday'],
        opens: '10:00',
        closes: '17:00',
      },
    ],
    priceRange: '$$$$',
    paymentAccepted: 'Cash, Credit Card, PayPal',
    currenciesAccepted: 'USD',
    areaServed: [
      { '@type': 'Place', name: 'Washington DC' },
      { '@type': 'Place', name: 'Maryland' },
      { '@type': 'Place', name: 'Virginia' },
      { '@type': 'Place', name: 'Rockville' },
      { '@type': 'Place', name: 'Bethesda' },
      { '@type': 'Place', name: 'Tysons' },
      { '@type': 'Place', name: 'Arlington' },
    ],
    serviceType: [
      'Exotic Car Rental',
      'Luxury Car Rental',
      'Supercar Rental',
      'Sports Car Rental',
      'Event Car Rental',
      'Wedding Car Rental',
    ],
    ...(aggregateRating && safeNumber(aggregateRating.ratingValue) > 0 && safeNumber(aggregateRating.ratingCount) > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Math.max(1, Math.min(5, safeNumber(aggregateRating.ratingValue))),
        bestRating: 5,
        worstRating: 1,
        ratingCount: Math.max(1, safeNumber(aggregateRating.ratingCount)),
        reviewCount: Math.max(1, safeNumber(aggregateRating.ratingCount)),
      },
    }),
  }
}

// Fallback schema generator for when main generation fails
function generateFallbackCarSchema(carName: string, slug: string): ProductSchema {
  const baseUrl = 'https://www.exodrive.co'
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: safeString(carName, 'Exotic Car'),
    image: [safeUrl('/placeholder.jpg', baseUrl)],
    description: `Experience the thrill of driving the ${safeString(carName, 'Exotic Car')}, available for rent through ExoDrive.`,
    sku: safeString(slug, 'car-rental'),
    brand: {
      '@type': 'Brand',
      name: 'Exotic',
    },
    category: 'Exotic Car',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${baseUrl}/cars/${safeString(slug)}`,
      seller: {
        '@type': 'Organization',
        name: 'ExoDrive Exotic Car Rentals',
      },
    },
    additionalProperty: [],
  }
}

// Safe Product/Vehicle Schema Generator for AppCar (new version)
export function generateAppCarVehicleSchema(car: AppCar, slug: string): ProductSchema | null {
  try {
    if (!car || !slug) {
      throw new Error('Car data or slug is missing')
    }
    return generateAppCarVehicleSchemaUnsafe(car, slug)
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in AppCar vehicle schema',
      context: `generateAppCarVehicleSchema(car.id: ${car?.id}, slug: ${slug})`,
      timestamp: new Date(),
    })
    // Return fallback schema
    return generateFallbackCarSchema(car?.name || 'Exotic Car', slug)
  }
}

// Internal unsafe version for actual generation
function generateAppCarVehicleSchemaUnsafe(car: AppCar, slug: string): ProductSchema {
  const baseUrl = safeString(SEO_CONFIG?.BRAND?.url, 'https://www.exodrive.co')
  const carUrl = `${baseUrl}/cars/${safeString(slug)}`
  const rawImages = safeArray(car.images?.map(img => img?.url).filter(Boolean))
  const images = rawImages.length > 0 ? rawImages.map(url => safeUrl(url, baseUrl)) : [safeUrl('/placeholder.jpg', baseUrl)]

  // Enhanced vehicle properties extraction with standardized naming
  const additionalProperties: PropertyValue[] = []
  
  try {
    const specs = safeArray(car.specifications)
    
    // Define specific properties we want to extract with SEO-friendly names
    const vehiclePropertyMap: Record<string, string> = {
      'Year': 'modelYear',
      'Engine': 'vehicleEngine',
      'Transmission': 'vehicleTransmission',
      'Drivetrain': 'driveWheelConfiguration',
      'Horsepower': 'enginePower',
      'Acceleration': 'acceleration0to60',
      'Top Speed': 'vehicleSpeed',
      'Fuel Type': 'fuelType',
      'Seating Capacity': 'vehicleSeatingCapacity',
      'Seating': 'vehicleSeatingCapacity',
      'Body Style': 'bodyType',
      'Body Type': 'bodyType',
      'Mileage': 'mileageFromOdometer',
      'Color': 'color',
      'Interior Color': 'vehicleInteriorColor',
      'Exterior Color': 'color'
    }
    
    specs.forEach(spec => {
      const name = safeString(spec?.name)
      const value = safeString(spec?.value)
      
      if (name && value) {
        // Use standardized property names for better SEO when available
        const standardName = vehiclePropertyMap[name] || name
        additionalProperties.push({
          '@type': 'PropertyValue',
          name: standardName,
          value,
        })
      }
    })
    
    // Add computed properties if base price exists (luxury categorization)
    const basePrice = safeNumber(car.pricing?.base_price)
    if (basePrice > 0) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: 'rentalCategory',
        value: basePrice > 1500 ? 'Exotic Supercar' : basePrice > 800 ? 'Luxury Sports' : 'Premium'
      })
      
      // Add ACRISS-like categorization if not present
      if (!specs.find(s => s?.name?.toLowerCase().includes('acriss'))) {
        additionalProperties.push({
          '@type': 'PropertyValue',
          name: 'vehicleClass',
          value: basePrice > 2000 ? 'XSAR' : basePrice > 1000 ? 'LTAR' : 'PDAR' // Exotic/Luxury/Premium codes
        })
      }
    }
  } catch (error) {
    // Skip specifications if they cause errors - maintains existing safety pattern
    console.debug('Specification extraction error (non-fatal):', error)
  }

  // Extract make and model safely
  const specs = safeArray(car.specifications)
  const makeSpec = specs.find(spec => spec?.name === 'Make')
  const modelSpec = specs.find(spec => spec?.name === 'Model')
  const makeName = safeString(makeSpec?.value, 'Exotic')
  const modelName = safeString(modelSpec?.value)
  
  const carName = safeString(car.name, 'Exotic Car')
  const description = safeString(
    car.description,
    `Experience the thrill of driving the ${carName}, available for rent through ${safeString(SEO_CONFIG?.BRAND?.fullName, 'ExoDrive')}.`
  )
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: carName,
    image: images,
    description,
    sku: safeString(car.id, `car-${slug}`),
    brand: {
      '@type': 'Brand',
      name: makeName,
    },
    category: safeString(car.category, 'Exotic Car'),
    ...(modelName && { model: modelName }),
    ...(makeName !== 'Exotic' && {
      manufacturer: {
        '@type': 'Organization',
        name: makeName,
      },
    }),
    offers: {
      '@type': 'Offer',
      ...(car.pricing?.base_price && { price: safeNumber(car.pricing.base_price).toString() }),
      priceCurrency: 'USD',
      availability: car.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: carUrl,
      seller: {
        '@type': 'Organization',
        name: safeString(SEO_CONFIG?.BRAND?.fullName, 'ExoDrive Exotic Car Rentals'),
      },
      ...(car.pricing?.base_price && safeNumber(car.pricing.base_price) > 0 && {
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: safeNumber(car.pricing.base_price).toString(),
          priceCurrency: 'USD',
          unitCode: 'DAY',
          unitText: 'per day',
        },
      }),
    },
    additionalProperty: additionalProperties,
    // Safely add aggregate rating if reviews are available
    ...(car.reviews && Array.isArray(car.reviews) && car.reviews.length > 0 && (() => {
      try {
        const approvedReviews = car.reviews.filter(review => 
          review?.is_approved === true && safeNumber(review?.rating) > 0
        )
        
        if (approvedReviews.length > 0) {
          const totalRating = approvedReviews.reduce((sum, review) => 
            sum + safeNumber(review.rating, 0), 0
          )
          const averageRating = totalRating / approvedReviews.length
          
          // Only add if we have a valid average
          if (averageRating > 0 && averageRating <= 5) {
            return {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Math.round(averageRating * 10) / 10, // Round to 1 decimal
                bestRating: 5,
                worstRating: 1,
                ratingCount: approvedReviews.length,
                reviewCount: approvedReviews.length
              }
            }
          }
        }
      } catch (error) {
        // Silent fail - don't break schema generation for rating issues
        console.debug('AggregateRating extraction failed (non-fatal):', error)
      }
      return {} // Return empty object if no valid ratings
    })()),
  }
}

// Safe Product/Vehicle Schema Generator (legacy version for Car interface)
export function generateVehicleSchema(car: Car, slug: string): ProductSchema | null {
  try {
    if (!car || !slug) {
      throw new Error('Car data or slug is missing')
    }
    return generateVehicleSchemaUnsafe(car, slug)
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in legacy vehicle schema',
      context: `generateVehicleSchema(car.id: ${car?.id}, slug: ${slug})`,
      timestamp: new Date(),
    })
    // Return fallback schema
    return generateFallbackCarSchema(car?.name || 'Exotic Car', slug)
  }
}

// Internal unsafe version for actual generation
function generateVehicleSchemaUnsafe(car: Car, slug: string): ProductSchema {
  const baseUrl = safeString(SEO_CONFIG?.BRAND?.url, 'https://www.exodrive.co')
  const carUrl = `${baseUrl}/cars/${safeString(slug)}`
  const rawImages = safeArray(car.imageUrls)
  const images = rawImages.length > 0 ? rawImages.map(url => safeUrl(url, baseUrl)) : [safeUrl('/placeholder.jpg', baseUrl)]

  // Create additional properties from car specifications
  const additionalProperties: PropertyValue[] = []
  
  try {
    const engine = safeString(car.engine)
    if (engine) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: 'Engine',
        value: engine,
      })
    }
    
    const horsepower = safeNumber(car.horsepower)
    if (horsepower > 0) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: 'Horsepower',
        value: horsepower.toString(),
      })
    }
    
    const acceleration = safeNumber(car.acceleration060)
    if (acceleration > 0) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: '0-60 mph',
        value: `${acceleration} seconds`,
      })
    }
    
    const topSpeed = safeNumber(car.topSpeed)
    if (topSpeed > 0) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: 'Top Speed',
        value: `${topSpeed} mph`,
      })
    }
    
    const transmission = safeString(car.transmission)
    if (transmission) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: 'Transmission',
        value: transmission,
      })
    }
    
    const drivetrain = safeString(car.drivetrain)
    if (drivetrain) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: 'Drivetrain',
        value: drivetrain,
      })
    }
  } catch {
    // Skip properties if they cause errors
  }

  const carName = safeString(car.name, 'Exotic Car')
  const makeName = safeString(car.make, 'Exotic')
  const modelName = safeString(car.model)
  const description = safeString(
    car.description,
    `Experience the thrill of driving the ${carName}, available for rent through ${safeString(SEO_CONFIG?.BRAND?.fullName, 'ExoDrive')}.`
  )
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: carName,
    image: images,
    description,
    sku: safeString(car.id, `car-${slug}`),
    brand: {
      '@type': 'Brand',
      name: makeName,
    },
    category: safeString(car.category, 'Exotic Car'),
    ...(modelName && { model: modelName }),
    ...(makeName !== 'Exotic' && {
      manufacturer: {
        '@type': 'Organization',
        name: makeName,
      },
    }),
    offers: {
      '@type': 'Offer',
      ...(car.pricePerDay && { price: safeNumber(car.pricePerDay).toString() }),
      priceCurrency: 'USD',
      availability: car.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: carUrl,
      seller: {
        '@type': 'Organization',
        name: safeString(SEO_CONFIG?.BRAND?.fullName, 'ExoDrive Exotic Car Rentals'),
      },
      ...(car.pricePerDay && safeNumber(car.pricePerDay) > 0 && {
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: safeNumber(car.pricePerDay).toString(),
          priceCurrency: 'USD',
          unitCode: 'DAY',
          unitText: 'per day',
        },
      }),
    },
    additionalProperty: additionalProperties,
  }
}

// Safe Breadcrumb Schema Generator
export function generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>): BreadcrumbListSchema | null {
  try {
    if (!breadcrumbs || breadcrumbs.length === 0) {
      throw new Error('Breadcrumbs array is empty or missing')
    }
    return generateBreadcrumbSchemaUnsafe(breadcrumbs)
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in breadcrumb schema',
      context: `generateBreadcrumbSchema(${breadcrumbs?.length || 0} items)`,
      timestamp: new Date(),
    })
    // Return minimal fallback breadcrumb
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: safeString(SEO_CONFIG?.BRAND?.url, 'https://www.exodrive.co'),
        },
      ],
    }
  }
}

// Internal unsafe version for actual generation
function generateBreadcrumbSchemaUnsafe(breadcrumbs: Array<{ name: string; url: string }>): BreadcrumbListSchema {
  const validBreadcrumbs = breadcrumbs.filter(crumb => 
    safeString(crumb?.name) && safeString(crumb?.url)
  )
  
  if (validBreadcrumbs.length === 0) {
    throw new Error('No valid breadcrumbs found')
  }
  
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: validBreadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: safeString(crumb.name),
      item: safeString(crumb.url),
    })),
  }
}

// FAQ Schema Generator
export interface FAQItem {
  question: string
  answer: string
}

// Safe FAQ Schema Generator
export function generateFAQSchema(faqs: FAQItem[]): FAQPageSchema | null {
  try {
    if (!faqs || faqs.length === 0) {
      return null // FAQ schema is optional
    }
    return generateFAQSchemaUnsafe(faqs)
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in FAQ schema',
      context: `generateFAQSchema(${faqs?.length || 0} items)`,
      timestamp: new Date(),
    })
    return null
  }
}

// Internal unsafe version for actual generation
function generateFAQSchemaUnsafe(faqs: FAQItem[]): FAQPageSchema {
  const validFAQs = faqs.filter(faq => 
    safeString(faq?.question) && safeString(faq?.answer)
  )
  
  if (validFAQs.length === 0) {
    throw new Error('No valid FAQ items found')
  }
  
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: validFAQs.map(faq => ({
      '@type': 'Question',
      name: safeString(faq.question),
      acceptedAnswer: {
        '@type': 'Answer',
        text: safeString(faq.answer),
      },
    })),
  }
}

// Safe helper function to combine multiple schemas
export function combineSchemas(...schemas: (BaseSchema | null)[]): string {
  try {
    // Filter out null schemas and ensure we have valid schemas
    const validSchemas = schemas.filter((schema): schema is BaseSchema => 
      schema !== null && 
      typeof schema === 'object' && 
      schema['@context'] && 
      schema['@type']
    )
    
    if (validSchemas.length === 0) {
      return '{}' // Return empty object if no valid schemas
    }
    
    return combineSchemasSafe(validSchemas)
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error combining schemas',
      context: `combineSchemas(${schemas.length} schemas)`,
      timestamp: new Date(),
    })
    return '{}'
  }
}

// Internal safe combine function
function combineSchemasSafe(schemas: BaseSchema[]): string {
  try {
    if (schemas.length === 1) {
      return JSON.stringify(schemas[0], null, 2)
    }
    
    return JSON.stringify(schemas, null, 2)
  } catch {
    return '{}'
  }
}

// Safe helper function to inject schema into page
export function createSchemaScript(schema: BaseSchema | BaseSchema[] | null): string {
  try {
    if (!schema) {
      return '' // Return empty string if no schema
    }
    
    const jsonContent = Array.isArray(schema) 
      ? combineSchemas(...schema)
      : JSON.stringify(schema, null, 2)
    
    // Validate that we have valid JSON content
    if (!jsonContent || jsonContent === '{}') {
      return ''
    }
    
    // Additional validation: ensure the JSON is parseable
    try {
      JSON.parse(jsonContent)
    } catch {
      logSchemaError({
        message: 'Generated schema content is not valid JSON',
        context: 'createSchemaScript - JSON validation',
        timestamp: new Date(),
      })
      return ''
    }
    
    return `<script type="application/ld+json">${jsonContent}</script>`
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error creating schema script',
      context: 'createSchemaScript',
      timestamp: new Date(),
    })
    return ''
  }
}

// Safe schema validation helper
export function validateSchema(schema: any): schema is BaseSchema {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    typeof schema['@context'] === 'string' &&
    typeof schema['@type'] === 'string'
  )
}

// Helper to safely render schema in React components (requires React import)
export function renderSchemaScript(schema: BaseSchema | BaseSchema[] | null): any {
  try {
    if (!schema) return null
    
    const jsonContent = Array.isArray(schema) 
      ? combineSchemas(...schema)
      : JSON.stringify(schema, null, 2)
    
    if (!jsonContent || jsonContent === '{}') {
      return null
    }
    
    // Validate the JSON content before rendering
    try {
      JSON.parse(jsonContent)
    } catch {
      logSchemaError({
        message: 'Schema content failed JSON validation in renderSchemaScript',
        context: 'renderSchemaScript - JSON validation',
        timestamp: new Date(),
      })
      return null
    }
    
    return {
      type: 'script',
      props: {
        type: 'application/ld+json',
        dangerouslySetInnerHTML: { __html: jsonContent }
      }
    }
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in renderSchemaScript',
      context: 'renderSchemaScript',
      timestamp: new Date(),
    })
    return null
  }
}

// Enhanced safe JSON stringification with error recovery
export function safeJsonStringify(data: any, fallback: string = '{}'): string {
  try {
    if (!data) return fallback
    
    // First attempt - standard JSON stringify
    const result = JSON.stringify(data, null, 2)
    
    // Validate the result is parseable
    JSON.parse(result)
    
    return result
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'JSON stringification failed',
      context: 'safeJsonStringify',
      timestamp: new Date(),
    })
    
    // Attempt to stringify individual properties if it's an object
    if (typeof data === 'object' && data !== null) {
      try {
        const safeData: Record<string, any> = {}
        for (const [key, value] of Object.entries(data)) {
          try {
            // Test if this property can be stringified
            JSON.stringify(value)
            safeData[key] = value
          } catch {
            // Skip problematic properties
            continue
          }
        }
        const result = JSON.stringify(safeData, null, 2)
        JSON.parse(result) // Validate
        return result
      } catch {
        return fallback
      }
    }
    
    return fallback
  }
}

// Circuit breaker for schema generation to prevent repeated failures
class SchemaCircuitBreaker {
  private failures: Map<string, { count: number; lastFailure: Date }> = new Map()
  private readonly maxFailures = 3
  private readonly resetTimeout = 300000 // 5 minutes

  shouldSkip(context: string): boolean {
    const failure = this.failures.get(context)
    if (!failure) return false

    const timeSinceLastFailure = Date.now() - failure.lastFailure.getTime()
    
    // Reset if enough time has passed
    if (timeSinceLastFailure > this.resetTimeout) {
      this.failures.delete(context)
      return false
    }

    return failure.count >= this.maxFailures
  }

  recordFailure(context: string): void {
    const existing = this.failures.get(context)
    if (existing) {
      this.failures.set(context, {
        count: existing.count + 1,
        lastFailure: new Date()
      })
    } else {
      this.failures.set(context, {
        count: 1,
        lastFailure: new Date()
      })
    }
  }

  reset(context: string): void {
    this.failures.delete(context)
  }
}

const schemaCircuitBreaker = new SchemaCircuitBreaker()

// Enhanced schema generation wrapper with circuit breaker
export function withCircuitBreaker<T extends any[], R>(
  fn: (...args: T) => R | null,
  context: string,
  fallback: R | null = null
) {
  return (...args: T): R | null => {
    // Check circuit breaker
    if (schemaCircuitBreaker.shouldSkip(context)) {
      logSchemaError({
        message: `Circuit breaker open - skipping ${context}`,
        context,
        timestamp: new Date(),
      })
      return fallback
    }

    try {
      const result = fn(...args)
      // Reset circuit breaker on success
      schemaCircuitBreaker.reset(context)
      return result
    } catch (error) {
      schemaCircuitBreaker.recordFailure(context)
      logSchemaError({
        message: error instanceof Error ? error.message : `Unknown error in ${context}`,
        context,
        timestamp: new Date(),
      })
      return fallback
    }
  }
}

// Safe schema component factory for Next.js pages
export function createSafeSchemaComponent(
  schemas: (BaseSchema | null)[],
  context: string = 'unknown'
): React.JSX.Element | null {
  try {
    const validSchemas = schemas.filter((schema): schema is BaseSchema => 
      schema !== null && validateSchema(schema)
    )
    
    if (validSchemas.length === 0) {
      return null
    }
    
    const schemaData = validSchemas.length === 1 ? validSchemas[0] : validSchemas
    const schemaJson = safeJsonStringify(schemaData)
    
    if (!schemaJson || schemaJson === '{}') {
      logSchemaError({
        message: 'Generated schema resulted in empty JSON',
        context: `createSafeSchemaComponent - ${context}`,
        timestamp: new Date(),
      })
      return null
    }
    
    return React.createElement('script', {
      type: 'application/ld+json',
      dangerouslySetInnerHTML: { __html: schemaJson }
    })
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in createSafeSchemaComponent',
      context: `createSafeSchemaComponent - ${context}`,
      timestamp: new Date(),
    })
    return null
  }
}

// Health check function for schema generation system
export function checkSchemaSystemHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy'
  details: Record<string, any>
} {
  const healthCheck = {
    status: 'healthy' as const,
    details: {
      organizationSchema: false,
      vehicleSchema: false,
      breadcrumbSchema: false,
      faqSchema: false,
      errors: [] as string[],
      timestamp: new Date().toISOString()
    }
  }
  
  try {
    // Test organization schema
    const orgSchema = generateOrganizationSchema()
    healthCheck.details.organizationSchema = orgSchema !== null && validateSchema(orgSchema)
    
    // Test vehicle schema with mock data
    const mockCar = {
      id: 'test',
      name: 'Test Car',
      description: 'Test Description',
      category: 'Test',
      available: true,
      images: [],
      specifications: [],
      pricing: { base_price: 100 }
    }
    const vehicleSchema = generateAppCarVehicleSchema(mockCar as any, 'test-slug')
    healthCheck.details.vehicleSchema = vehicleSchema !== null && validateSchema(vehicleSchema)
    
    // Test breadcrumb schema
    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: 'Home', url: 'https://www.exodrive.co' },
      { name: 'Test', url: 'https://www.exodrive.co/test' }
    ])
    healthCheck.details.breadcrumbSchema = breadcrumbSchema !== null && validateSchema(breadcrumbSchema)
    
    // Test FAQ schema
    const faqSchema = generateFAQSchema([
      { question: 'Test Question?', answer: 'Test Answer' }
    ])
    healthCheck.details.faqSchema = faqSchema !== null && validateSchema(faqSchema)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    healthCheck.details.errors.push(errorMessage)
  }
  
  // Determine overall health status
  const successCount = Object.values(healthCheck.details)
    .filter((value, index) => index < 4 && value === true).length
  
  if (successCount === 4) {
    healthCheck.status = 'healthy'
  } else if (successCount >= 2) {
    healthCheck.status = 'degraded'
  } else {
    healthCheck.status = 'unhealthy'
  }
  
  return healthCheck
}

// Common FAQ items for exotic car rentals
export const COMMON_FAQS: FAQItem[] = [
  {
    question: 'What is the minimum age requirement to rent an exotic car?',
    answer: 'You must be at least 25 years old to rent an exotic or luxury vehicle from ExoDrive. All drivers must have a valid driver\'s license and meet our insurance requirements.',
  },
  {
    question: 'What documents do I need to rent an exotic car?',
    answer: 'You\'ll need a valid driver\'s license, major credit card, and proof of insurance. International drivers may need an International Driving Permit along with their home country license.',
  },
  {
    question: 'Is insurance included with exotic car rentals?',
    answer: 'Basic insurance coverage is included with all rentals. We also offer additional coverage options for enhanced protection. Please review our insurance policy details during booking.',
  },
  {
    question: 'Can you deliver the rental car to my location?',
    answer: 'Yes, we offer delivery service throughout the DMV area including Washington DC, Maryland, and Virginia. Delivery fees vary based on location and distance from our Rockville facility.',
  },
  {
    question: 'What is your cancellation policy?',
    answer: 'Cancellations made 48 hours or more before pickup receive a full refund minus processing fees. Cancellations within 48 hours may be subject to penalty fees.',
  },
  {
    question: 'Do you offer hourly or daily rental options?',
    answer: 'We offer flexible rental periods including hourly, daily, weekly, and monthly options. Minimum rental periods vary by vehicle type and season.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, PayPal, and cash deposits. A credit card authorization is required for all rentals regardless of payment method.',
  },
  {
    question: 'Are there mileage restrictions on exotic car rentals?',
    answer: 'Daily rentals include reasonable mileage allowances. Extended rentals may have different mileage terms. Excess mileage fees apply beyond included limits.',
  },
]

// Safe Aggregate Rating Schema Template
export function generateAggregateRatingSchema(
  ratingValue: number,
  reviewCount: number,
  bestRating: number = 5,
  worstRating: number = 1
): AggregateRating | null {
  try {
    const safeRating = safeNumber(ratingValue)
    const safeCount = safeNumber(reviewCount)
    const safeBest = safeNumber(bestRating, 5)
    const safeWorst = safeNumber(worstRating, 1)
    
    if (safeRating <= 0 || safeCount <= 0) {
      return null // Invalid rating data
    }
    
    return generateAggregateRatingSchemaUnsafe(safeRating, safeCount, safeBest, safeWorst)
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in rating schema',
      context: `generateAggregateRatingSchema(${ratingValue}, ${reviewCount})`,
      timestamp: new Date(),
    })
    return null
  }
}

// Internal unsafe version for actual generation
function generateAggregateRatingSchemaUnsafe(
  ratingValue: number,
  reviewCount: number,
  bestRating: number = 5,
  worstRating: number = 1
): AggregateRating {
  return {
    '@type': 'AggregateRating',
    ratingValue: Math.max(worstRating, Math.min(bestRating, Number(ratingValue.toFixed(1)))),
    bestRating,
    worstRating,
    ratingCount: Math.max(1, Math.floor(reviewCount)),
    reviewCount: Math.max(1, Math.floor(reviewCount)),
  }
}

// Safe Review Schema Generator
export function generateReviewSchema(review: {
  rating: number
  author: string
  date: string
  title?: string
  content?: string
}): Review | null {
  try {
    if (!review) {
      throw new Error('Review data is missing')
    }
    return generateReviewSchemaUnsafe(review)
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in review schema',
      context: `generateReviewSchema(author: ${review?.author})`,
      timestamp: new Date(),
    })
    return null
  }
}

// Internal unsafe version for actual generation
function generateReviewSchemaUnsafe(review: {
  rating: number
  author: string
  date: string
  title?: string
  content?: string
}): Review {
  const rating = Math.max(1, Math.min(5, safeNumber(review.rating, 5)))
  const author = safeString(review.author, 'Anonymous')
  const date = safeString(review.date)
  
  if (!date || !author) {
    throw new Error('Required review fields are missing')
  }
  
  return {
    '@type': 'Review',
    reviewRating: {
      '@type': 'Rating',
      ratingValue: rating,
      bestRating: 5,
      worstRating: 1,
    },
    author: {
      '@type': 'Person',
      name: author,
    },
    datePublished: date,
    ...(safeString(review.title) && { name: safeString(review.title) }),
    ...(safeString(review.content) && { reviewBody: safeString(review.content) }),
  }
}

// Safe Service Schema for different rental types
export function generateServiceSchema(serviceType: 'wedding' | 'corporate' | 'photoshoot' | 'general') {
  try {
    return generateServiceSchemaUnsafe(serviceType)
  } catch (error) {
    logSchemaError({
      message: error instanceof Error ? error.message : 'Unknown error in service schema',
      context: `generateServiceSchema(${serviceType})`,
      timestamp: new Date(),
    })
    // Return fallback general service schema
    return generateFallbackServiceSchema()
  }
}

// Fallback service schema
function generateFallbackServiceSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Exotic Car Rental Service',
    description: 'Premium exotic and luxury car rental service.',
    provider: {
      '@type': 'Organization',
      name: 'ExoDrive Exotic Car Rentals',
      url: 'https://www.exodrive.co',
    },
    areaServed: [
      { '@type': 'Place', name: 'Washington DC' },
      { '@type': 'Place', name: 'Maryland' },
      { '@type': 'Place', name: 'Virginia' },
    ],
    serviceType: 'Car Rental',
  }
}

// Internal unsafe version for actual generation
function generateServiceSchemaUnsafe(serviceType: 'wedding' | 'corporate' | 'photoshoot' | 'general') {
  const baseUrl = safeString(SEO_CONFIG?.BRAND?.url, 'https://www.exodrive.co')
  const brandName = safeString(SEO_CONFIG?.BRAND?.fullName, 'ExoDrive Exotic Car Rentals')
  
  const baseService = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: '',
    description: '',
    provider: {
      '@type': 'Organization',
      name: brandName,
      url: baseUrl,
    },
    areaServed: [
      { '@type': 'Place', name: 'Washington DC' },
      { '@type': 'Place', name: 'Maryland' },
      { '@type': 'Place', name: 'Virginia' },
    ],
    serviceType: 'Car Rental',
  }

  switch (serviceType) {
    case 'wedding':
      return {
        ...baseService,
        name: 'Wedding Exotic Car Rental',
        description: 'Luxury and exotic car rentals for weddings in the DMV area. Make your special day unforgettable with our premium fleet.',
        audience: {
          '@type': 'Audience',
          audienceType: 'Wedding Couples',
        },
      }
    case 'corporate':
      return {
        ...baseService,
        name: 'Corporate Luxury Car Rental',
        description: 'Professional exotic and luxury car rental services for corporate events, business travel, and executive transportation.',
        audience: {
          '@type': 'Audience',
          audienceType: 'Business Professionals',
        },
      }
    case 'photoshoot':
      return {
        ...baseService,
        name: 'Exotic Car Rental for Photography',
        description: 'Rent exotic and luxury cars for professional photoshoots, music videos, and content creation in the DMV area.',
        audience: {
          '@type': 'Audience',
          audienceType: 'Photographers and Content Creators',
        },
      }
    default:
      return {
        ...baseService,
        name: 'Exotic Car Rental Service',
        description: 'Premium exotic and luxury car rental service in Washington DC, Maryland, and Virginia.',
      }
  }
}