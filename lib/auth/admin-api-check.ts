import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, type SupabaseCookieStore } from '@/lib/supabase/server';

export interface AdminApiCheckResult {
  isValid: boolean;
  user?: any;
  response?: NextResponse;
}

/**
 * Checks if the request has valid admin authentication
 * Returns early response if authentication fails
 * 
 * @param cookies - SupabaseCookieStore (ReadonlyRequestCookies or RequestCookies)
 * @returns Object with isValid flag, user data, and optional error response
 */
export async function checkAdminApiAuth(cookies: SupabaseCookieStore): Promise<AdminApiCheckResult> {
  try {
    const supabase = createSupabaseServerClient(cookies);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Admin API authentication error:', authError);
      return {
        isValid: false,
        response: NextResponse.json(
          { 
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
          },
          { status: 401 }
        )
      };
    }

    // Check profiles table for admin role (secure approach - primary check)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    const isAdmin = profile?.role === 'admin';
    
    // Log for debugging (includes both sources for transition period)
    console.log('Admin API check:', {
      email: user.email,
      profileRole: profile?.role,
      metadataRole: user.user_metadata?.role, // For debugging only
      isAdmin
    });
    
    if (!isAdmin) {
      console.log('Admin API access denied:', { 
        email: user.email, 
        profileRole: profile?.role,
        metadataRole: user.user_metadata?.role 
      });
      return {
        isValid: false,
        response: NextResponse.json(
          { 
            error: 'Forbidden - Admin access required',
            code: 'FORBIDDEN'
          },
          { status: 403 }
        )
      };
    }

    return {
      isValid: true,
      user
    };
  } catch (error) {
    console.error('Error in admin API auth check:', error);
    return {
      isValid: false,
      response: NextResponse.json(
        { 
          error: 'Internal error during authentication check',
          code: 'INTERNAL_ERROR'
        },
        { status: 500 }
      )
    };
  }
}