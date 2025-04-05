import { getSupabaseBrowserClient } from './client';
import { createSupabaseServiceRoleClient } from './server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from './server';

/**
 * Test if the Supabase connection is working properly
 * This can be used to debug connection issues
 */
export async function testSupabaseConnection() {
  let publicAccess: any = { success: false, error: null, data: null };
  let serviceAccessCars: any = { success: false, error: null, data: null };
  let serviceAccessAuthUsers: any = { success: false, error: null, data: null };
  let message = "";

  try {
    // Test anonymous client
    const supabase = getSupabaseBrowserClient(); 
    if (!supabase) {
      throw new Error("Failed to initialize Supabase browser client.");
    }
    const { data: publicData, error: publicError } = await supabase
      .from('cars')
      .select('id, name')
      .limit(1);
    publicAccess = { success: !publicError, error: publicError?.message, data: publicData };

    // Test service role client
    const serviceClient = createSupabaseServiceRoleClient();
    if (!serviceClient) {
       throw new Error("Failed to initialize Supabase service client.");
    }
    // Test service access to 'cars'
    const { data: adminDataCars, error: adminErrorCars } = await serviceClient
      .from('cars') // Target: public.cars
      .select('id, name')
      .limit(1);
    serviceAccessCars = { success: !adminErrorCars, error: adminErrorCars?.message, data: adminDataCars };

    // Test service access to 'public.profiles' (linked to auth.users)
    // This assumes a 'profiles' table exists in the public schema
    const { data: adminDataProfiles, error: adminErrorProfiles } = await serviceClient
      .from('profiles') // Target: public.profiles
      .select('id') // Assuming 'id' column links to auth.users.id
      .limit(1);
    serviceAccessAuthUsers = { success: !adminErrorProfiles, error: adminErrorProfiles?.message, data: adminDataProfiles }; // Reusing the variable name for simplicity

    message = "Supabase connection tests completed";

  } catch (error) {
    console.error("Error testing Supabase connection:", error);
    message = error instanceof Error ? error.message : "Unknown error occurred during connection test";
  }

  return {
      success: publicAccess.success && serviceAccessCars.success && serviceAccessAuthUsers.success,
      message,
      publicAccess,
      serviceAccessCars,
      serviceAccessAuthUsers
    };
}

/**
 * Test if authentication is working properly (Needs context)
 * This function now needs the cookie store passed in for server-side checks.
 */
export async function testSupabaseAuthServer() {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);

    // Check current auth state
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    return {
      success: true,
      message: "Server-side Auth check completed",
      authenticated: !!user,
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role
      } : null,
      error: userError?.message
    };
  } catch (error) {
    console.error("Error testing Supabase server-side auth:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
} 