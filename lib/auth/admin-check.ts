import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export interface AdminCheckResult {
  isAdmin: boolean;
  user: any | null;
  error?: string;
}

/**
 * Checks if the authenticated user has admin privileges
 * @param request - NextRequest object for API routes
 * @returns Object containing admin status, user data, and any error
 */
export async function checkAdminAuth(request: NextRequest): Promise<AdminCheckResult> {
  try {
    const supabase = createSupabaseServerClient(request.cookies as any);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        isAdmin: false,
        user: null,
        error: 'Not authenticated'
      };
    }

    // Check profiles table for admin role (secure approach)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    const isAdmin = profile?.role === 'admin';
    
    // Log for debugging (includes both sources for transition period)
    console.log(`Admin check for ${user.email}:`, {
      profileRole: profile?.role,
      metadataRole: user.user_metadata?.role, // For debugging only
      isAdmin
    });
    
    return {
      isAdmin,
      user,
      error: isAdmin ? undefined : 'User does not have admin privileges'
    };
  } catch (error) {
    console.error('Error in admin auth check:', error);
    return {
      isAdmin: false,
      user: null,
      error: 'Internal error during authentication check'
    };
  }
}

/**
 * Checks if the authenticated user has admin privileges (for server actions)
 * @param cookieStore - ReadonlyRequestCookies from next/headers
 * @returns Object containing admin status, user data, and any error
 */
export async function checkAdminAuthServerAction(cookieStore: any): Promise<AdminCheckResult> {
  try {
    const supabase = createSupabaseServerClient(cookieStore);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        isAdmin: false,
        user: null,
        error: 'Not authenticated'
      };
    }

    // Check profiles table for admin role (secure approach)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    const isAdmin = profile?.role === 'admin';
    
    // Log for debugging (includes both sources for transition period)
    console.log(`Admin check for ${user.email}:`, {
      profileRole: profile?.role,
      metadataRole: user.user_metadata?.role, // For debugging only
      isAdmin
    });
    
    return {
      isAdmin,
      user,
      error: isAdmin ? undefined : 'User does not have admin privileges'
    };
  } catch (error) {
    console.error('Error in admin auth check:', error);
    return {
      isAdmin: false,
      user: null,
      error: 'Internal error during authentication check'
    };
  }
}