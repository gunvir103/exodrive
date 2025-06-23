import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    
    // Check authentication
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    let profileData = null;
    let profileError = null;
    
    // If user exists, check profile
    if (authData?.user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, created_at, updated_at')
        .eq('id', authData.user.id)
        .single();
      
      profileData = data;
      profileError = error;
    }
    
    // Debug information
    const debugInfo = {
      timestamp: new Date().toISOString(),
      authentication: {
        success: !authError && !!authData?.user,
        error: authError?.message || null,
        user: authData?.user ? {
          id: authData.user.id,
          email: authData.user.email,
          role_in_metadata: authData.user.user_metadata?.role,
          last_sign_in: authData.user.last_sign_in_at,
          email_confirmed: authData.user.email_confirmed_at,
        } : null,
      },
      profile: {
        found: !!profileData,
        error: profileError?.message || null,
        data: profileData,
      },
      admin_status: {
        from_metadata: authData?.user?.user_metadata?.role === 'admin',
        from_profile: profileData?.role === 'admin',
        consistent: (authData?.user?.user_metadata?.role === 'admin') === (profileData?.role === 'admin'),
      },
      cookies: {
        auth_token_present: !!cookieStore.get('sb-ncdukddsefogzbqsbfsa-auth-token'),
        cookie_count: cookieStore.size,
      }
    };
    
    return NextResponse.json({
      success: true,
      debug: debugInfo,
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}