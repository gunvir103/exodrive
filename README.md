# exoDrive - Exotic Car Rental Website

This is the codebase for exoDrive, a luxury and exotic car rental service operating in the DMV area. The website showcases the fleet of exotic cars and allows customers to browse and contact the business for rentals.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Backend Integration](#backend-integration)
- [Deployment](#deployment)
- [Homepage Settings](#homepage-settings)
- [Database Verification](#database-verification)

## Overview

exoDrive is a Next.js application that provides a modern, responsive interface for customers to browse exotic cars available for rent. The website includes a public-facing frontend for customers and an admin dashboard for managing the car fleet and bookings.

## Features

- **Public Website**:
  - Homepage with featured cars and company information
  - Fleet page with filtering and search capabilities
  - Detailed car pages with specifications and booking options
  - Contact page for customer inquiries
  - Instagram integration for rental requests

- **Admin Dashboard**:
  - Secure login system
  - Dashboard overview with key metrics
  - Car management (add, edit, delete)
  - Booking management
  - Settings and configuration

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with custom gradient utilities
- **UI Components**: shadcn/ui
- **Animations**: Framer Motion
- **Authentication**: Custom auth with localStorage (for demo purposes)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/gunvir103/exodrive.git
   cd exodrive

## Project Structure

```
/app
  /(main)          # Routes for the public-facing website
    /about
    /contact
    /fleet
      /[carSlug]    # Dynamic car detail page
    page.tsx        # Homepage
    layout.tsx      # Main layout for public site
  /admin            # Routes for the admin dashboard
    /cars
      /new          # Add new car page
      /[carSlug]    # Edit car page
      page.tsx        # List cars page
    /bookings       # (Placeholder/Future Implementation)
    /settings       # (Placeholder/Future Implementation)
    login           # Admin login page
    page.tsx        # Admin dashboard homepage
    layout.tsx      # Main layout for admin section
  /api              # API routes (if any)
  /auth             # Auth-related routes (e.g., callback)
  layout.tsx        # Root layout
  globals.css
/components
  /ui               # shadcn/ui components
  /auth-provider.tsx # Context for managing auth state
  /car-card.tsx      # Component for displaying car previews
  /car-detail       # Components specific to the car detail page
  /car-form.tsx      # The main form for adding/editing cars
  # ... other shared components (Navbar, Footer, etc.)
/lib
  /supabase         # Supabase client/server helpers
  /services         # Data fetching/mutation logic (e.g., carServiceSupabase)
  /types            # TypeScript type definitions (AppCar, database.types.ts)
  /utils            # Utility functions
/public             # Static assets (images, etc.)
# ... config files (tailwind.config.js, next.config.js, etc.)
```

## Backend Integration (Supabase)

This project uses Supabase for its backend needs:

- **Database:** PostgreSQL database to store car details, pricing, features, specifications, images, etc. See `SUPABASE_SETUP.md` for the detailed schema.
- **Authentication:** Supabase Auth handles user authentication. Admin access is controlled via RLS policies checking against the `app.admin_emails` database setting.
- **Storage:** Supabase Storage is used to store car images in the `vehicle-images` bucket.
- **RLS:** Row Level Security policies are crucial for securing data access. Public users can only read non-hidden car data, while admins have full CRUD access (requires manual policy setup).
- **Atomic Operations:** Database functions (RPC) like `create_car_atomic` are used to ensure data consistency during multi-table operations.

See `SUPABASE_SETUP.md` for detailed setup instructions, schema, and required RLS policies.

## Admin Dashboard

The admin dashboard provides authenticated users (whose emails are listed in the `app.admin_emails` Supabase setting) with tools to manage the car fleet.

- **Access:** Navigate to `/admin`. If not logged in, you'll be redirected to `/admin/login`.
- **Login:** Use the email/password of an admin user account created in Supabase Auth.
- **Core Routes:**
    - `/admin`: Dashboard homepage (currently basic).
    - `/admin/cars`: View, search, and manage all car listings (including hidden ones).
    - `/admin/cars/new`: Add a new car listing using the `CarForm`.
    - `/admin/cars/[carSlug]`: Edit an existing car listing using the `CarForm`.
- **Car Management:**
    - **Add/Edit:** The `CarForm` allows managing all car details: basic info, pricing, descriptions, visibility (Available, Featured, Hidden), image uploads (drag-and-drop reordering, primary image selection), features (key-value), and specifications (key-value, including common fields like Make, Model, Year, Engine, etc.).
    - **Delete:** (Button currently disabled in UI) Deleting a car removes its record and all associated data (pricing, images, features, specs) from the database and deletes its images from storage.
- **Important Setup:** For CRUD operations to function, the Admin RLS Policies and the `app.admin_emails` setting **must** be correctly configured in your Supabase project as detailed in `SUPABASE_SETUP.md` and previous setup instructions.

## Homepage Settings

### Set Up the Featured Car

The homepage features a car section that can be dynamically configured through the admin panel. To set this up:

1. **Run Database Migrations**
   
   Before using the homepage settings feature, you need to run the database migrations to create the required tables:
   ```bash
   npm run db:migrate
   ```

2. **Configure Featured Car**
   
   After running the migration, go to the admin dashboard and:
   
   - Navigate to "Homepage Settings" in the sidebar
   - Select a car from the dropdown to feature on the homepage
   - Click "Save Settings"
   
   The selected car will now appear in the featured section on the homepage.

3. **Troubleshooting**
   
   If you encounter issues:
   
   - Make sure your Supabase project is properly set up
   - Ensure you have admin rights to modify the settings
   - Check that you have at least one car in your database

## Deployment

# ... (Deployment instructions remain the same) ...

## Database Verification

ExoDrive includes tools to verify the database configuration and check for archived cars:

### Local Verification

Run the database verification script locally:

```bash
npm run verify:db
```

This script will:
- Connect to your Supabase database
- Verify that all cars have required fields
- Test Row Level Security policies for hidden cars
- Generate a detailed report in `db-verification-report.json`

### GitHub Action Verification

A GitHub Action is set up to run the database verification automatically:
- On every push/commit to ensure code stability and data safety
- On all pull requests to catch issues before they're merged
- Weekly on Monday at midnight
- Manually through the GitHub Actions interface

The verification serves as a critical safety check that:
- Confirms database connectivity
- Verifies data integrity (e.g., all required fields are present)
- Tests that RLS policies properly protect hidden cars
- Ensures admin routes can access all cars including hidden ones

Results are stored as artifacts in the GitHub Actions workflow, with detailed summaries provided directly in the GitHub interface.

### Archived Cars

The database verification script specifically checks for cars with `hidden=true` to ensure:
1. Archived cars exist in the database
2. RLS policies correctly protect archived cars from public access
3. Admin routes can access archived cars for editing purposes

Archived cars are visible in the admin panel at `/admin/cars` but not in the public fleet at `/fleet`.

