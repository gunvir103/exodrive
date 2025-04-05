# Supabase Setup Documentation

## Database Configuration

### Cars Table Schema
```sql
create table public.cars (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  slug text unique not null,
  description text,
  short_description text,
  price_per_day decimal(10,2) not null,
  category text not null,
  transmission text,
  horsepower integer,
  acceleration_0_60 decimal(4,1),
  top_speed integer,
  image_urls text[] default '{}',
  video_urls text[] default '{}',
  is_available boolean default true,
  is_featured boolean default false,
  is_hidden boolean default false
);

-- Enable Row Level Security (RLS)
alter table public.cars enable row level security;

-- Create policies
create policy "Public cars are viewable by everyone" on cars
  for select using (not is_hidden);

create policy "Admins can do everything" on cars
  for all using (
    auth.role() = 'authenticated' 
    and auth.jwt() ->> 'email' in (select unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  );
```

### Media Storage

Media files (images and videos) are stored in Supabase Storage buckets. The application uses two buckets:

1. `car-images` - For storing car images
2. `car-videos` - For storing car videos

#### Storage Bucket Setup
```sql
-- Create storage buckets
insert into storage.buckets (id, name, public) 
values ('car-images', 'car-images', true);

insert into storage.buckets (id, name, public) 
values ('car-videos', 'car-videos', true);

-- Set up storage policies
create policy "Car images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'car-images' );

create policy "Car videos are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'car-videos' );

create policy "Only authenticated users can upload car media"
  on storage.objects for insert
  with check (
    auth.role() = 'authenticated' 
    and (bucket_id = 'car-images' or bucket_id = 'car-videos')
    and auth.jwt() ->> 'email' in (select unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  );

create policy "Only authenticated users can update car media"
  on storage.objects for update
  using (
    auth.role() = 'authenticated' 
    and (bucket_id = 'car-images' or bucket_id = 'car-videos')
    and auth.jwt() ->> 'email' in (select unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  );

create policy "Only authenticated users can delete car media"
  on storage.objects for delete
  using (
    auth.role() = 'authenticated' 
    and (bucket_id = 'car-images' or bucket_id = 'car-videos')
    and auth.jwt() ->> 'email' in (select unnest(string_to_array(current_setting('app.admin_emails'), ',')))
  );
```

### Image and Video Handling

1. **Image URLs**: Stored in the `image_urls` array column of the cars table
   - Format: Full Supabase storage URLs
   - Example: `https://<project>.supabase.co/storage/v1/object/public/car-images/ferrari-f8.jpg`

2. **Video URLs**: Stored in the `video_urls` array column of the cars table
   - Format: Full Supabase storage URLs
   - Example: `https://<project>.supabase.co/storage/v1/object/public/car-videos/ferrari-f8-review.mp4`

### Environment Variables

Required environment variables for Supabase configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Authentication

The application uses Supabase Auth with the following setup:

1. Email/Password authentication enabled
2. Admin access controlled by checking email against `app.admin_emails` setting
3. Row Level Security (RLS) policies in place for:
   - Public access to non-hidden cars
   - Admin access to all car operations
   - Protected media upload/modification

### Admin Setup

To set up admin access:

1. Create a new user through Supabase Auth
2. Set the admin emails in Supabase settings:
```sql
alter database your_database_name set "app.admin_emails" = 'admin1@example.com,admin2@example.com';
```

## CRUD Operations

The application implements CRUD operations through:

1. **Create**: POST to `/api/cars` endpoint (admin only)
2. **Read**: GET from `/api/cars` endpoint (public for non-hidden cars)
3. **Update**: PUT to `/api/cars/:id` endpoint (admin only)
4. **Delete**: DELETE to `/api/cars/:id` endpoint (admin only)

Media files are handled separately through Supabase Storage APIs. 

## Website Integration

### Data Flow Architecture

1. **Server-Side Data Fetching**
   - The application uses server components (e.g., `app/fleet/page.tsx`) to fetch data using Supabase service role client
   - Data is fetched with a 60-second revalidation period to optimize performance
   - Fallback data is provided in case of fetch errors
   - Example implementation:
   ```typescript
   const serviceClient = createSupabaseServiceRoleClient();
   const cars = await carServiceSupabase.getVisibleCars(serviceClient);
   ```

2. **Client-Side State Management**
   - Initial data is passed from server components to client components
   - Client components (e.g., `FleetClientComponent`) handle:
     - Filtering and sorting of cars
     - Search functionality
     - Category filtering
     - URL state management for filters
   - State updates are managed through React hooks (useState, useEffect)

3. **UI Components**
   - Cars are displayed using the `CarCard` component
   - Filtering UI includes:
     - Search input
     - Category filters
     - Sort options
   - Loading states are handled with custom loading components
   - Error boundaries catch and display errors gracefully

4. **Performance Optimizations**
   - Server-side data fetching with caching
   - Client-side filtering to reduce server load
   - Suspense boundaries for loading states
   - Error boundaries for graceful error handling
   - Image optimization through Next.js Image component

### Database to UI Mapping

1. **Cars Table → Fleet Page**
   ```
   Database Field    → UI Display
   ----------------------------------
   name             → Car title
   price_per_day    → Daily rate
   category         → Filter category
   image_urls       → Car images
   description      → Car details
   is_featured      → Featured sorting
   is_available     → Availability badge
   ```

2. **Search Implementation**
   - Search queries filter across multiple fields:
     - name
     - description
     - category
     - make/model

3. **Category Filtering**
   - Categories are dynamically generated from the database
   - Filters are applied client-side for performance
   - URL parameters maintain filter state

4. **Sort Options**
   - Featured (default): Prioritizes is_featured=true
   - Price (ascending/descending)
   - Name (alphabetical)

### Security Considerations

1. **Public Access**
   - RLS policies ensure only non-hidden cars are publicly visible
   - Sensitive fields are filtered out server-side

2. **Admin Access**
   - Protected routes (/admin) require authentication
   - Admin operations use service role client
   - Environment variables secure API access 