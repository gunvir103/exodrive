import { NextRequest, NextResponse } from 'next/server';
import { getConnectionMetrics, logAllMetrics } from '@/lib/database/client-manager';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (you may want to add your own admin check logic)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get metrics
    const metrics = getConnectionMetrics();
    
    // Log to console if requested
    if (request.nextUrl.searchParams.get('log') === 'true') {
      logAllMetrics();
    }

    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching database metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database metrics' },
      { status: 500 }
    );
  }
}