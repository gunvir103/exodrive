# Schema.org Structured Data Implementation

## Overview
Enhanced the ExoDrive application with comprehensive Schema.org structured data using JSON-LD format to improve SEO and enable rich snippets in search results.

## Implementation Details

### 1. Enhanced app/layout.tsx
- Added Organization schema to all pages globally
- Provides comprehensive business information including:
  - Contact details (phone, email, address)
  - Business hours and service areas
  - Social media profiles
  - Opening hours specification

**Schema Type:** Organization
**Scope:** Applied globally to all pages

### 2. Enhanced app/cars/[slug]/page.tsx
- Added Product/Vehicle schema for individual car pages
- Added BreadcrumbList schema for navigation
- Dynamic data population based on actual car information

**Schema Types:** 
- Product (for vehicle details)
- BreadcrumbList (for navigation)
**Scope:** Individual car detail pages

### 3. Updated lib/seo/structured-data.ts
- Created new `generateAppCarVehicleSchema()` function compatible with AppCar type
- Improved data mapping from Supabase database structure
- Added proper price, availability, and specification handling

## Features Implemented

### Organization Schema Includes:
- Business name and branding information
- Physical address and contact information
- Operating hours and service areas
- Social media presence
- Contact points with availability

### Vehicle/Product Schema Includes:
- Car name, description, and images
- Brand and manufacturer information
- Pricing information (daily rental rates)
- Availability status
- Technical specifications as additional properties
- SKU and category information

### Breadcrumb Schema Includes:
- Hierarchical navigation structure
- Proper URL and naming conventions
- Position-based ordering

## Technical Implementation

### JSON-LD Format
All schemas use proper JSON-LD formatting with:
- `@context`: "https://schema.org"
- `@type`: Appropriate schema type
- Proper structured data nesting

### Next.js Integration
- Server-side generation for SEO benefits
- Proper dangerouslySetInnerHTML usage
- Script tag with type="application/ld+json"
- Multiple schemas combined in arrays where appropriate

### Data Mapping
- Maps AppCar database structure to Schema.org format
- Handles optional fields gracefully
- Proper data type conversions
- Fallback values for missing data

## SEO Benefits

1. **Rich Snippets**: Search engines can display enhanced results
2. **Local SEO**: Organization schema improves local search visibility
3. **Product Information**: Detailed car information in search results
4. **Navigation**: Breadcrumbs help with site structure understanding
5. **Brand Authority**: Complete business information builds trust

## Validation
The implementation follows Google's Rich Results guidelines and can be tested using:
- Google's Rich Results Test
- Schema.org validator
- Google Search Console

## Schema Types Used
- `Organization`: Business information
- `Product`: Individual vehicles
- `BreadcrumbList`: Site navigation
- `Offer`: Pricing and availability
- `PropertyValue`: Technical specifications
- `Brand`: Vehicle manufacturers
- `ContactPoint`: Business contact information
- `PostalAddress`: Physical location