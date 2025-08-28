import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Test client-side auth client
    const cookieStore = await cookies();
    
    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Ignore errors in API routes
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Ignore errors in API routes
            }
          },
        },
      }
    );
    
    const { data: authData, error: authError } = await supabaseServer.auth.getSession();
    
    // Test service role client (be careful not to expose sensitive data)
    const supabaseAdmin = createSupabaseServiceRoleClient();
    
    // Simple query to check connection
    const { data: testData, error: testError } = await supabaseServer
      .from('cars')
      .select('count()')
      .limit(1);
      
    const result = {
      connection: {
        publicClientWorking: !authError,
        serviceClientWorking: !!supabaseAdmin, // Just check if client created
        dbQueryWorking: !testError,
      },
      stats: {
        sessionExists: !!authData?.session,
        carCount: testData?.[0]?.count || 0,
      },
      projectRef: process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].split('//')[1],
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return NextResponse.json(
      { error: 'Connection test failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 