-- Create homepage_settings table to store various homepage configuration options
CREATE TABLE IF NOT EXISTS public.homepage_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  featured_car_id UUID REFERENCES public.cars(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.homepage_settings IS 'Stores configuration settings for the homepage, including the featured car';

-- Set up Row Level Security
ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;

-- Only allow admins to manage homepage settings
CREATE POLICY "Admin users can manage homepage settings" 
ON public.homepage_settings 
FOR ALL 
USING (
  auth.role() = 'authenticated' 
  AND auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'), ',')))
) 
WITH CHECK (
  auth.role() = 'authenticated' 
  AND auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'), ',')))
);

-- Anyone can view the homepage settings
CREATE POLICY "Public users can view homepage settings" 
ON public.homepage_settings 
FOR SELECT 
USING (true); 