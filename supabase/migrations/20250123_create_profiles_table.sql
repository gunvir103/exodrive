-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update updated_at column
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Policy: Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON public.profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Users can update their own profile (except role field)
CREATE POLICY "Users can update own profile except role" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        -- Ensure role doesn't change unless user is admin
        (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR
         EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, created_at, updated_at)
    VALUES (NEW.id, 'user', NOW(), NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Insert profile for existing admin user from mock data if exists
-- The mock admin user has email 'admin@exodrive.com'
INSERT INTO public.profiles (id, role, created_at, updated_at)
SELECT 
    id,
    'admin',
    COALESCE(created_at, NOW()),
    NOW()
FROM auth.users
WHERE email = 'admin@exodrive.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin',
    updated_at = NOW();

-- Create profiles for any other existing users that don't have profiles yet
INSERT INTO public.profiles (id, role, created_at, updated_at)
SELECT 
    id,
    'user',
    COALESCE(created_at, NOW()),
    NOW()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- Add index on role for performance when checking admin status
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Add index on id for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);