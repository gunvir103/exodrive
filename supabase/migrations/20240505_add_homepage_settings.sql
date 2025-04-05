-- Create homepage_settings table to store various homepage configuration options
BEGIN;

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.homepage_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  featured_car_id UUID REFERENCES public.cars(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.homepage_settings IS 'Stores configuration settings for the homepage, including the featured car';

-- Create an updated_at trigger function if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_timestamp') THEN
    CREATE OR REPLACE FUNCTION update_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create the trigger on homepage_settings
DROP TRIGGER IF EXISTS update_homepage_settings_timestamp ON public.homepage_settings;
CREATE TRIGGER update_homepage_settings_timestamp
BEFORE UPDATE ON public.homepage_settings
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Set up Row Level Security
ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;

-- Only allow admins to manage homepage settings
DROP POLICY IF EXISTS "Admin users can manage homepage settings" ON public.homepage_settings;
CREATE POLICY "Admin users can manage homepage settings" 
ON public.homepage_settings 
FOR ALL 
USING (
  auth.role() = 'authenticated' 
  AND auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ',')) as email)
) 
WITH CHECK (
  auth.role() = 'authenticated' 
  AND auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ',')) as email)
);

-- Anyone can view the homepage settings
DROP POLICY IF EXISTS "Public users can view homepage settings" ON public.homepage_settings;
CREATE POLICY "Public users can view homepage settings" 
ON public.homepage_settings 
FOR SELECT 
USING (true);

-- Add an index on featured_car_id for faster lookups
CREATE INDEX IF NOT EXISTS homepage_settings_featured_car_id_idx ON public.homepage_settings(featured_car_id);

COMMIT; 