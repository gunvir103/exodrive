-- Create cars table
CREATE TABLE IF NOT EXISTS cars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT,
  category TEXT NOT NULL,
  available BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create car_specifications table
CREATE TABLE IF NOT EXISTS car_specifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  is_highlighted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create car_features table
CREATE TABLE IF NOT EXISTS car_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_highlighted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create car_images table
CREATE TABLE IF NOT EXISTS car_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  path TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create car_reviews table
CREATE TABLE IF NOT EXISTS car_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  date TEXT NOT NULL,
  comment TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create car_pricing table
CREATE TABLE IF NOT EXISTS car_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  base_price DECIMAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  discount_percentage DECIMAL,
  special_offer_text TEXT,
  deposit_amount DECIMAL NOT NULL,
  minimum_days INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create car_additional_fees table
CREATE TABLE IF NOT EXISTS car_additional_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create car_availability table
CREATE TABLE IF NOT EXISTS car_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'booked', 'maintenance', 'pending')),
  booking_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(car_id, date)
);

-- Create hero_content table if it doesn't exist
CREATE TABLE IF NOT EXISTS hero_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  background_type TEXT NOT NULL CHECK (background_type IN ('image', 'video')),
  background_src TEXT NOT NULL,
  badge_text TEXT NOT NULL,
  primary_button_text TEXT NOT NULL,
  primary_button_link TEXT NOT NULL,
  secondary_button_text TEXT NOT NULL,
  secondary_button_link TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('cars', 'Car images', true),
  ('hero', 'Hero backgrounds', true),
  ('general', 'General uploads', true),
  ('vehicle-images', 'Vehicle Images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Public Access to Car Images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cars');

CREATE POLICY "Public Access to Hero Backgrounds"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hero');

CREATE POLICY "Admin Access to Car Images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cars' AND auth.role() = 'authenticated');

CREATE POLICY "Admin Access to Hero Backgrounds"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'hero' AND auth.role() = 'authenticated');

CREATE POLICY "Public Access to Vehicle Images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-images');

CREATE POLICY "Authenticated Access to Vehicle Images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-images' AND auth.role() = 'authenticated');

-- Create triggers to update updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cars_timestamp
BEFORE UPDATE ON cars
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_car_pricing_timestamp
BEFORE UPDATE ON car_pricing
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_car_availability_timestamp
BEFORE UPDATE ON car_availability
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_hero_content_timestamp
BEFORE UPDATE ON hero_content
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Enable RLS and add Policies
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to non-hidden cars"
  ON cars FOR SELECT
  USING (hidden = false);

CREATE POLICY "Allow public read access to images of non-hidden cars"
  ON car_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM cars c WHERE c.id = car_images.car_id AND c.hidden = false));

-- Add Admin/Authenticated write policies later as needed

-- Appended content from 20240320_hero_content.sql:
-- Create function to set active hero
CREATE OR REPLACE FUNCTION set_active_hero(hero_id UUID)
RETURNS VOID AS $$
BEGIN
  -- First, set all heroes to inactive
  UPDATE hero_content SET is_active = false;
  
  -- Then set the specified hero to active
  UPDATE hero_content SET is_active = true WHERE id = hero_id;
END;
$$ LANGUAGE plpgsql;

