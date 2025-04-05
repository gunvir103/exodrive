import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { handleSupabaseError } from '@/lib/supabase/client';
import { testSupabaseConnection } from '@/lib/supabase/test-connection';

export async function GET() {
  const timestamp = new Date().toISOString();
  let connectionResult: any = null;
  let authResult: any = null;

  try {
    // --- Test Connection (using service client internally) ---
    // The testSupabaseConnection function still internally creates clients,
    // including the problematic service client. Let's call it first.
    try {
      connectionResult = await testSupabaseConnection();
    } catch (connError) {
      console.error('Error during testSupabaseConnection call:', connError);
      connectionResult = { 
        success: false, 
        message: connError instanceof Error ? connError.message : "Connection test failed" 
      };
    }

    // --- Test Auth (Server-side in API Route context) ---
    try {
      const cookieStore = await cookies(); // Correct way to get cookies in Route Handler
      const supabase = createSupabaseServerClient(cookieStore); // Create client directly here
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      authResult = {
        success: true,
        message: "Server-side Auth check completed in API route",
        authenticated: !!user,
        user: user ? { id: user.id, email: user.email, role: user.role } : null,
        error: userError?.message
      };
    } catch (authError) {
      console.error("Error testing Supabase server-side auth in API route:", authError);
      authResult = {
        success: false,
        message: authError instanceof Error ? handleSupabaseError(authError) : "Unknown auth error occurred"
      };
    }
    
    // --- Construct Final Response --- 
    return NextResponse.json({
      timestamp,
      // We still expect connectionResult.serviceAccess to fail based on previous tests
      connection: connectionResult, 
      auth: authResult
    });

  } catch (error) {
    // Catch errors from the overall handler logic (less likely now)
    console.error('Error in test-supabase API route handler:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'An unexpected error occurred in handler',
        timestamp
      },
      { status: 500 }
    );
  }
} 