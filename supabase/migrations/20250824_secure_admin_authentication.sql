-- Migration: Secure Admin Authentication System
-- Purpose: Replace insecure user_metadata role checks with secure database-backed admin verification
-- Security Fix: Prevents privilege escalation through client-side metadata modification

-- Step 1: Create secure admin verification function
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Check if user has admin role in profiles table
  -- This is the single source of truth for admin status
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles
    WHERE id = user_id 
    AND role = 'admin'
  );
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.is_admin IS 'Securely checks if a user is an admin by querying the profiles table. This function should be used in all RLS policies instead of checking JWT metadata.';

-- Step 2: Sync existing admin users from metadata to profiles table
-- This ensures current admins retain access
DO $$
DECLARE
  admin_user RECORD;
BEGIN
  -- Find all users with admin role in metadata
  FOR admin_user IN 
    SELECT id, raw_user_meta_data
    FROM auth.users
    WHERE raw_user_meta_data->>'role' = 'admin'
  LOOP
    -- Update or insert admin role in profiles table
    INSERT INTO public.profiles (id, role, created_at, updated_at)
    VALUES (admin_user.id, 'admin', NOW(), NOW())
    ON CONFLICT (id) 
    DO UPDATE SET 
      role = 'admin',
      updated_at = NOW()
    WHERE profiles.role != 'admin';
    
    RAISE NOTICE 'Synced admin user: %', admin_user.id;
  END LOOP;
END;
$$;

-- Step 3: Create trigger to sync role changes from profiles to user metadata
-- This maintains backward compatibility with existing code
CREATE OR REPLACE FUNCTION public.sync_admin_role_to_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When role is set to admin in profiles, update user metadata
  IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role != 'admin') THEN
    UPDATE auth.users
    SET raw_user_meta_data = 
      COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', 'admin')
    WHERE id = NEW.id;
  -- When role is removed from admin, update metadata
  ELSIF OLD.role = 'admin' AND NEW.role != 'admin' THEN
    UPDATE auth.users
    SET raw_user_meta_data = 
      raw_user_meta_data - 'role'
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for role sync
DROP TRIGGER IF EXISTS sync_admin_role_trigger ON public.profiles;
CREATE TRIGGER sync_admin_role_trigger
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_role_to_metadata();

-- Step 4: Update all RLS policies to use secure is_admin() function

-- Update bookings table policies
ALTER POLICY "Admins can view all bookings" ON public.bookings
  USING (public.is_admin());

ALTER POLICY "Admins can update all bookings" ON public.bookings
  USING (public.is_admin());

ALTER POLICY "Admins can delete bookings" ON public.bookings
  USING (public.is_admin());

ALTER POLICY "Service role and admins can insert bookings" ON public.bookings
  WITH CHECK (
    auth.role() = 'service_role' OR 
    public.is_admin()
  );

-- Update customers table policies
ALTER POLICY "Admins can manage all customers" ON public.customers
  USING (public.is_admin());

-- Update payments table policies
ALTER POLICY "Admins can view all payments" ON public.payments
  USING (public.is_admin());

ALTER POLICY "Admins can update payment status" ON public.payments
  USING (public.is_admin());

-- Update inbox_emails table policies
DROP POLICY IF EXISTS "Admins can manage inbox emails" ON public.inbox_emails;
CREATE POLICY "Admins can manage inbox emails" ON public.inbox_emails
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Update car_availability table policies
ALTER POLICY "Admins can view all availability" ON public.car_availability
  USING (public.is_admin());

ALTER POLICY "Admins can manage availability" ON public.car_availability
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Update booking_secure_tokens table policies
ALTER POLICY "Admins can view all tokens" ON public.booking_secure_tokens
  USING (public.is_admin());

ALTER POLICY "Admins can delete tokens" ON public.booking_secure_tokens
  USING (public.is_admin());

-- Update booking_locations table policies
ALTER POLICY "Admins can view all locations" ON public.booking_locations
  USING (public.is_admin());

ALTER POLICY "Admins can manage locations" ON public.booking_locations
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Update booking_media table policies
ALTER POLICY "Admins can view all booking media" ON public.booking_media
  USING (public.is_admin());

ALTER POLICY "Admins can manage booking media" ON public.booking_media
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Update storage policies for booking-media bucket
DROP POLICY IF EXISTS "Admins can view all booking media files" ON storage.objects;
CREATE POLICY "Admins can view all booking media files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'booking-media' AND 
    public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can manage booking media files" ON storage.objects;
CREATE POLICY "Admins can manage booking media files" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'booking-media' AND 
    public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'booking-media' AND 
    public.is_admin()
  );

-- Update storage policies for rental-agreements bucket
DROP POLICY IF EXISTS "Admins can view all rental agreements" ON storage.objects;
CREATE POLICY "Admins can view all rental agreements" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'rental-agreements' AND 
    public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can manage rental agreements" ON storage.objects;
CREATE POLICY "Admins can manage rental agreements" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'rental-agreements' AND 
    public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'rental-agreements' AND 
    public.is_admin()
  );

-- Update webhook_retries table policies (uses email-based admin check)
-- These already use a different pattern, so we'll leave them as is for now
-- They check against app.admin_emails configuration setting

-- Step 5: Create helper function for getting admin users
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Only admins can see the list of admin users
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only admins can view admin users';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id as user_id,
    u.email,
    p.role,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'admin'
  ORDER BY p.created_at;
END;
$$;

-- Step 6: Create function to grant admin access (for secure admin management)
CREATE OR REPLACE FUNCTION public.grant_admin_access(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only existing admins can grant admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only admins can grant admin access';
  END IF;
  
  -- Update the user's role in profiles table
  UPDATE public.profiles
  SET role = 'admin', updated_at = NOW()
  WHERE id = target_user_id;
  
  -- If no row was updated, insert a new profile
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, role, created_at, updated_at)
    VALUES (target_user_id, 'admin', NOW(), NOW());
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Step 7: Create function to revoke admin access
CREATE OR REPLACE FUNCTION public.revoke_admin_access(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only existing admins can revoke admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only admins can revoke admin access';
  END IF;
  
  -- Prevent removing the last admin
  IF (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin user';
  END IF;
  
  -- Update the user's role in profiles table
  UPDATE public.profiles
  SET role = 'user', updated_at = NOW()
  WHERE id = target_user_id AND role = 'admin';
  
  RETURN FOUND;
END;
$$;

-- Step 8: Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role_admin ON public.profiles(id) 
WHERE role = 'admin';

-- Step 9: Add audit log for admin actions (optional but recommended)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log
  FOR SELECT
  USING (public.is_admin());

-- Create trigger to log admin role changes
CREATE OR REPLACE FUNCTION public.log_admin_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.role != NEW.role AND (OLD.role = 'admin' OR NEW.role = 'admin') THEN
    INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, metadata)
    VALUES (
      auth.uid(),
      CASE 
        WHEN NEW.role = 'admin' THEN 'grant_admin'
        ELSE 'revoke_admin'
      END,
      NEW.id,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_admin_role_changes_trigger ON public.profiles;
CREATE TRIGGER log_admin_role_changes_trigger
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_admin_role_changes();

-- Migration complete
-- This migration:
-- 1. Creates a secure is_admin() function as the single source of truth
-- 2. Syncs existing admin users from metadata to profiles table
-- 3. Updates all RLS policies to use the secure function
-- 4. Maintains backward compatibility with metadata sync
-- 5. Adds admin management functions with proper access control
-- 6. Includes audit logging for security compliance