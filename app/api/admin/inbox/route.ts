import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify user has admin role in metadata
    const isAdmin = user.user_metadata?.role === 'admin';
    
    console.log('Admin check for inbox API:', {
      email: user.email,
      metadata: user.user_metadata,
      role: user.user_metadata?.role,
      isAdmin
    });
    
    if (!isAdmin) {
      // Fallback: check profiles table if metadata doesn't have role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profile?.role !== 'admin') {
        console.log('Access denied:', { 
          email: user.email, 
          metadataRole: user.user_metadata?.role,
          profileRole: profile?.role 
        });
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
      }
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";

    // Build query
    let query = supabase
      .from("inbox_emails")
      .select(`
        *,
        booking:bookings(
          id,
          customer:customers(first_name,last_name)
        )
      `, { count: "exact" });

    // Apply filters
    if (search) {
      query = query.or(`recipient_email.ilike.%${search}%,sender_email.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    if (status !== "all") {
      switch (status) {
        case "delivered":
          query = query.eq("last_event_type", "email.delivered");
          break;
        case "opened":
          query = query.not("opened_at", "is", null);
          break;
        case "clicked":
          query = query.not("clicked_at", "is", null);
          break;
        case "bounced":
          query = query.eq("last_event_type", "email.bounced");
          break;
        case "failed":
          query = query.in("last_event_type", ["email.delivery_failed", "email.bounced"]);
          break;
      }
    }

    // Execute query with pagination
    const { data: emails, error, count } = await query
      .order("last_event_at", { ascending: false })
      .range(offset, offset + limit - 1);

    console.log('Query results:', {
      emailCount: emails?.length || 0,
      totalCount: count,
      error: error?.message
    });

    if (error) {
      console.error("Error fetching inbox emails:", error);
      return NextResponse.json(
        { error: "Failed to fetch emails", details: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match the expected structure
    const transformedEmails = (emails || []).map(email => ({
      ...email,
      booking: email.booking ? {
        id: email.booking.id,
        customer: {
          name: `${email.booking.customer?.first_name || ''} ${email.booking.customer?.last_name || ''}`.trim() || 'Unknown'
        }
      } : null
    }));

    return NextResponse.json({
      emails: transformedEmails,
      totalCount: count || 0,
      currentPage: page,
      totalPages: Math.ceil((count || 0) / limit)
    });

  } catch (error) {
    console.error("Error in inbox API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}