# Supabase Setup Documentation

## Database Schema

The database utilizes a normalized structure with several tables to store car information.

### `cars` Table

Stores the core, static information about each car.

```sql
CREATE TABLE public.cars (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug text UNIQUE NOT NULL,         -- URL-friendly identifier, derived from name
  name text NOT NULL,                -- Display name of the car model
  description text NOT NULL,         -- Full description for the detail page
  short_description text NULL,       -- Brief description for listing pages
  category text NOT NULL,            -- e.g., Supercar, SUV, Sedan
  available boolean NOT NULL DEFAULT true, -- Is the car currently rentable?
  featured boolean NOT NULL DEFAULT false, -- Should it be highlighted?
  hidden boolean NOT NULL DEFAULT false,   -- Hide from public view (admin only)
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- Policies for `cars` table
CREATE POLICY "Public cars are viewable by everyone" ON public.cars
  FOR SELECT USING (available = true AND hidden = false);

CREATE POLICY "Admins can manage cars" ON public.cars
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  ) WITH CHECK (
    auth.role() = 'authenticated' 
    AND auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  );

-- TODO: Consider adding index on `slug` for faster lookups
-- CREATE INDEX idx_cars_slug ON public.cars(slug);
```

### `car_pricing` Table

Stores pricing details for each car. Assumes a one-to-one relationship with `cars` for simplicity.

```sql
CREATE TABLE public.car_pricing (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE UNIQUE, -- Foreign key, unique for 1-to-1
  base_price numeric NOT NULL,        -- Price per day
  currency text NOT NULL DEFAULT 'USD',
  deposit_amount numeric NOT NULL,    -- Security deposit required
  discount_percentage numeric NULL,  -- Optional discount
  special_offer_text text NULL,      -- Optional text for offers
  minimum_days integer NOT NULL DEFAULT 1, -- Minimum rental duration
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now()
);

-- RLS: Inherited via `cars` or allow public read access if needed separately
-- ALTER TABLE public.car_pricing ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public pricing is viewable" ON public.car_pricing FOR SELECT USING (true);
-- CREATE POLICY "Admin pricing management" ON public.car_pricing FOR ALL USING (auth.role() = 'authenticated' AND auth.jwt() ->> 'email' IN (...));
```

### `car_images` Table

Stores references to car images stored in Supabase Storage.

```sql
CREATE TABLE public.car_images (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  url text NOT NULL,                -- Public URL from Supabase Storage
  path text NULL,                   -- Storage path (e.g., user_id/uuid.jpg) for deletion
  alt text NULL,                    -- Image alt text
  is_primary boolean NOT NULL DEFAULT false, -- Is this the main display image?
  sort_order integer NOT NULL DEFAULT 0,    -- Order for gallery display
  created_at timestamptz NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY;

-- Policies for `car_images`
CREATE POLICY "Public images are viewable" ON public.car_images
  FOR SELECT USING (true); -- Or join with cars to check visibility

CREATE POLICY "Admins can manage images" ON public.car_images
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  ) WITH CHECK (
    auth.role() = 'authenticated' 
    AND auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  );

-- TODO: Add constraint for unique (car_id, path) if path is used for upserts
-- ALTER TABLE public.car_images ADD CONSTRAINT car_images_car_id_path_key UNIQUE (car_id, path);
```

### `car_features` Table

Stores key-value features for a car.

```sql
CREATE TABLE public.car_features (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  name text NOT NULL,             -- Feature name (e.g., "Bluetooth")
  description text NULL,          -- Optional description (e.g., "Wireless Apple CarPlay")
  is_highlighted boolean NOT NULL DEFAULT false, -- Show prominently?
  created_at timestamptz NULL DEFAULT now()
);

-- RLS: Similar to car_pricing
```

### `car_specifications` Table

Stores key-value specifications for a car.

```sql
CREATE TABLE public.car_specifications (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  name text NOT NULL,             -- Specification name (e.g., "Make", "Engine")
  value text NOT NULL,            -- Specification value (e.g., "Lamborghini", "5.2L V10")
  is_highlighted boolean NOT NULL DEFAULT false, -- Show prominently?
  created_at timestamptz NULL DEFAULT now()
);

-- RLS: Similar to car_pricing
```

### Other Tables (Not fully covered in refactor yet)

- `car_reviews`: For customer reviews.
- `car_additional_fees`: Optional extra fees.
- `car_availability`: Tracks booking/maintenance dates.
- `hero_content`: Content for the homepage hero section.

## Storage Configuration

Media files (images) are stored in Supabase Storage.

- **Bucket Name:** `vehicle-images` (Assumed, based on `BUCKET_NAMES.VEHICLE_IMAGES` constant)
- **Public Access:** Bucket should be configured for public reads.
- **Policies:**
    - **SELECT:** Public reads allowed.
    - **INSERT/UPDATE/DELETE:** Restricted to authenticated admins (via RLS on `storage.objects` or using signed URLs/service role on backend).

```sql
-- Example Storage Bucket Setup (Verify in Supabase Dashboard)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vehicle-images', 'vehicle-images', true) -- Set public = true
ON CONFLICT (id) DO NOTHING;

-- Example Storage Policies (Adjust based on security needs)
CREATE POLICY "Public vehicle images are viewable" 
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'vehicle-images' );

CREATE POLICY "Admin can upload vehicle images" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'vehicle-images' AND
    auth.role() = 'authenticated' AND
    auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  );

CREATE POLICY "Admin can update vehicle images" 
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'vehicle-images' AND
    auth.role() = 'authenticated' AND
    auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  );

CREATE POLICY "Admin can delete vehicle images" 
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vehicle-images' AND
    auth.role() = 'authenticated' AND
    auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  );
```

## Environment Variables

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Authentication

- Uses Supabase Auth (Email/Password assumed).
- Admin access controlled by checking user email against `app.admin_emails` setting via RLS policies.
- Ensure `app.admin_emails` is set correctly in your Supabase project settings:
  ```sql
  -- Run in Supabase SQL Editor
  ALTER DATABASE postgres SET "app.admin_emails" = 'admin1@example.com,admin2@example.com';
  ```

## CRUD Operations (via `carServiceSupabase`)

CRUD operations are now handled by the refactored service `lib/services/car-service-supabase.ts` interacting with the normalized tables.

- **Create (`createCar`):** Inserts records into `cars`, `car_pricing`, `car_images`, `car_features`, `car_specifications`.
- **Read (`getCarById`, `getCarBySlug`, etc.):** Fetches data from `cars` and joins/selects related data from other tables.
- **Update (`updateCar`):** Updates the `cars` table and upserts/deletes/inserts related data in other tables.
- **Delete (`deleteCar`):** Deletes the record from `cars` and cascades deletes to related tables. Also removes associated images from storage.

**Important:** The current service implementation performs multiple database operations sequentially for create/update/delete. For robust atomic operations in production, consider wrapping these calls within a Supabase Edge Function (RPC) using `BEGIN`/`COMMIT`/`ROLLBACK` (pg_transaction).

## Website Integration

### Data Fetching & Display

- **Admin Dashboard (`/admin/cars`):** Uses `carServiceSupabase.getAllCarsForAdminList` (fetches optimized list data).
- **Admin Edit Page (`/admin/cars/[carSlug]`):**
    - Server Component fetches full car details using `carServiceSupabase.getCarBySlug`.
    - Passes data to `CarForm` client component.
- **Car Form (`@/components/car-form.tsx`):**
    - Client component manages state for all fields.
    - Handles image uploads/deletions directly using the Supabase browser client (`@supabase/supabase-js`) and interacts with Supabase Storage.
    - Submits data using `carServiceSupabase.createCar` or `carServiceSupabase.updateCar`.
    - Maps common fields (Make, Model, Year, etc.) to the `car_specifications` table data.
- **Fleet Page (`/fleet`):**
    - Server Component likely fetches optimized list data using `carServiceSupabase.getVisibleCarsForFleet`.
    - Passes data to client component (`FleetClientComponent`) for filtering/sorting.
- **Car Detail Page (`/fleet/[carSlug]`):**
    - Server Component fetches full car details using `carServiceSupabase.getCarBySlug` and related cars using `getRelatedCars`.
    - Passes data to `CarDetailClient` component for rendering.

### Database to UI Mapping Example (`CarDetailClient`)

- `cars.name` -> Header Title
- `cars.short_description` -> Subtitle below header
- `car_pricing.base_price` -> Daily rate display
- `car_images` (array) -> `CarImageGallery` component
- `cars.description` -> `CarOverview` component
- `car_specifications` (array) -> `CarSpecifications` component
- `car_features` (array) -> `CarFeatures` component

### Security

- Public access controlled by RLS on `cars` table (`available=true`, `hidden=false`).
- Admin operations protected by RLS policies checking authenticated role and email match with `app.admin_emails`.
- Client-side operations (like image uploads in `CarForm`) use the Anon key but rely on Storage RLS policies for authorization.
- Service Role Key used for server-side data fetching/modification requiring elevated privileges.