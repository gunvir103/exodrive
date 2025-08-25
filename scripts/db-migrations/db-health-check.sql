-- Add the check_db_health RPC function to verify database connectivity and basic health

-- Function to check database connectivity and health
CREATE OR REPLACE FUNCTION check_db_health()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Run with privileges of the function creator
AS $$
BEGIN
  -- Basic connectivity test - if this function runs, the connection works
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Grant execute permission to authenticated users and anon
GRANT EXECUTE ON FUNCTION check_db_health() TO authenticated, anon; 