import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { cookies } from 'next/headers';

// Schema for validating query parameters
const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  sortBy: z.string().optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  // Optional filters
  overall_status: z.string().optional(), // Should match booking_overall_status_enum
  payment_status: z.string().optional(), // Should match payment_status_enum
  contract_status: z.string().optional(), // Should match contract_status_enum
  car_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  search: z.string().optional(), // For general text search on customer name, email, car name etc.
});

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  // TODO: Implement admin role check. For now, we assume the route is protected by middleware or other means.
  // const { data: { user }, error: userError } = await supabase.auth.getUser();
  // if (userError || !user) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }
  // const { data: userRole, error: roleError } = await supabase
  //  .from('user_roles') 
  //  .select('role')
  //  .eq('user_id', user.id)
  //  .single();
  // if (roleError || userRole?.role !== 'admin') {
  //   return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
  // }

  const { searchParams } = new URL(request.url);
  const queryParams = Object.fromEntries(searchParams.entries());

  const validationResult = listBookingsQuerySchema.safeParse(queryParams);

  if (!validationResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: validationResult.error.flatten() }, { status: 400 });
  }

  const {
    page,
    limit,
    sortBy,
    sortOrder,
    overall_status,
    payment_status,
    contract_status,
    car_id,
    customer_id,
    date_from,
    date_to,
    search
  } = validationResult.data;

  const offset = (page - 1) * limit;

  let query = supabase
    .from('bookings')
    .select(`
      id,
      created_at,
      start_date,
      end_date,
      total_price,
      currency,
      overall_status,
      payment_status,
      contract_status,
      cars (id, name, slug),
      customers (id, first_name, last_name, email)
    `, { count: 'exact' })
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (overall_status) query = query.eq('overall_status', overall_status);
  if (payment_status) query = query.eq('payment_status', payment_status);
  if (contract_status) query = query.eq('contract_status', contract_status);
  if (car_id) query = query.eq('car_id', car_id);
  if (customer_id) query = query.eq('customer_id', customer_id);
  if (date_from) query = query.gte('start_date', date_from); // Or use a 'created_at' range filter depending on UX
  if (date_to) query = query.lte('end_date', date_to);     // Or use a 'created_at' range filter
  
  // Apply general text search (example: search customer name/email or car name)
  // This is a basic search. For more advanced full-text search, you might need to set up tsvector columns and use to_tsquery.
  if (search) {
    query = query.or(`customers.first_name.ilike.%${search}%,customers.last_name.ilike.%${search}%,customers.email.ilike.%${search}%,cars.name.ilike.%${search}%`);
    // Note: The above .or() on joined tables requires careful syntax and might need adjustment based on Supabase version or direct RPC call for complexity.
    // A simpler approach might be to search fewer fields or fetch more data and filter in the app if performance allows.
    // Or, if Supabase supports it directly, something like: cars!inner(name.ilike.%${search}%), etc.
    // For a robust search, a dedicated search function (PL/pgSQL) might be better.
  }

  const { data: bookings, error, count } = await query;

  if (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings', details: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: bookings,
    meta: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
} 