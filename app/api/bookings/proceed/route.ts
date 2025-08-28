import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { getDocuSealService } from '@/lib/services/docuseal-service'

const proceedSchema = z.object({
  carId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(7),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = proceedSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const { carId, startDate, endDate, customer } = parsed.data
    // Use service-role client to bypass RLS for public booking initiation
    const supabase = createSupabaseServiceRoleClient()

    // Upsert customer by email
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customer.email)
      .maybeSingle()

    let customerId = existing?.id
    if (customerId) {
      await supabase
        .from('customers')
        .update({ first_name: customer.firstName, last_name: customer.lastName, phone: customer.phone })
        .eq('id', customerId)
    } else {
      const ins = await supabase
        .from('customers')
        .insert({ email: customer.email, first_name: customer.firstName, last_name: customer.lastName, phone: customer.phone })
        .select('id')
        .single()
      if (ins.error) {
        return NextResponse.json({ error: 'Failed to create customer', details: ins.error.message }, { status: 500 })
      }
      customerId = ins.data.id
    }

    // Compute total price from car_pricing (base_price * inclusive days)
    const { data: pricing } = await supabase
      .from('car_pricing')
      .select('base_price')
      .eq('car_id', carId)
      .single()

    const basePrice = pricing?.base_price ?? 0
    const s = new Date(startDate)
    const e = new Date(endDate)
    const days = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const totalPrice = days * basePrice

    // Create booking in pending payment / not_sent contract
    const bookingInsert = await supabase
      .from('bookings')
      .insert({
        car_id: carId,
        customer_id: customerId!,
        start_date: startDate,
        end_date: endDate,
        total_price: totalPrice,
        currency: 'USD',
        payment_status: 'pending',
        overall_status: 'pending_payment',
        contract_status: 'not_sent',
      })
      .select('id')
      .single()
    if (bookingInsert.error) {
      return NextResponse.json({ error: 'Failed to create booking', details: bookingInsert.error.message }, { status: 500 })
    }
    const bookingId = bookingInsert.data.id

    // Generate DocuSeal contract immediately (send email to customer)
    const docuseal = getDocuSealService()
    const contract = await docuseal.generateContract(bookingId)

    return NextResponse.json({
      success: true,
      bookingId,
      contract
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error in POST /api/bookings/proceed:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
