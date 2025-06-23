import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient(request.cookies);
    
    // Get user from auth
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData?.user) {
      return NextResponse.json({
        success: false,
        error: authError?.message || 'No user found',
      }, { status: 401 });
    }
    
    const user = authData.user;
    
    // Check profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    // Check if profile exists
    let profileExists = !!profileData;
    let profileRole = profileData?.role;
    
    // If no profile exists, try to create one
    if (!profileData && user.email) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          role: user.user_metadata?.role || 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (!createError && newProfile) {
        profileExists = true;
        profileRole = newProfile.role;
      }
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        metadata_role: user.user_metadata?.role,
        raw_metadata: user.user_metadata,
      },
      profile: {
        exists: profileExists,
        role: profileRole,
        data: profileData,
        error: profileError?.message,
      },
      admin_check: {
        from_metadata: user.user_metadata?.role === 'admin',
        from_profile: profileRole === 'admin',
        should_be_admin: user.user_metadata?.role === 'admin' || profileRole === 'admin',
      },
    });
    
  } catch (error) {
    console.error('Debug auth error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}