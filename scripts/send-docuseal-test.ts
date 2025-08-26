/**
 * Usage: bun run scripts/send-docuseal-test.ts
 * Creates minimal car, pricing, specs, customer, booking records
 * and invokes DocuSealService to send a contract to the given customer.
 */
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import { getDocuSealService } from '@/lib/services/docuseal-service'
import { randomUUID } from 'crypto'

async function main() {
  // Validate required env vars
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DOCUSEAL_API_URL',
    'DOCUSEAL_API_TOKEN',
    'DOCUSEAL_TEMPLATE_ID',
  ] as const

  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    console.error('Missing environment variables:', missing.join(', '))
    process.exit(1)
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1) Ensure a car exists (pick first or create a test car)
  let car = null as any
  {
    const { data } = await supabase.from('cars').select('id, name, slug').limit(1)
    if (data && data[0]) {
      car = data[0]
    } else {
      const carId = randomUUID()
      const slug = `test-car-${carId.slice(0, 8)}`
      const insert = await supabase
        .from('cars')
        .insert({
          id: carId,
          name: 'Ferrari 488',
          slug,
          category: 'supercar',
          description: 'Test car for DocuSeal contract',
          available: true,
          hidden: false,
        })
        .select()
        .single()
      if (insert.error) throw insert.error
      car = insert.data
    }
  }

  // 2) Ensure pricing exists
  {
    const { data } = await supabase
      .from('car_pricing')
      .select('id, base_price')
      .eq('car_id', car.id)
      .maybeSingle()
    if (!data) {
      const res = await supabase.from('car_pricing').insert({
        car_id: car.id,
        base_price: 500,
        currency: 'USD',
        deposit_amount: 0,
        minimum_days: 1,
      })
      if (res.error) throw res.error
    }
  }

  // 3) Ensure car specifications exist (Make/Model/Year/Color)
  {
    const { data: specs } = await supabase
      .from('car_specifications')
      .select('name')
      .eq('car_id', car.id)

    const have = new Set((specs || []).map((s) => (s as any).name.toLowerCase()))
    const needed: Array<{ name: string; value: string }> = []
    if (!have.has('make')) needed.push({ name: 'Make', value: 'Ferrari' })
    if (!have.has('model')) needed.push({ name: 'Model', value: '488' })
    if (!have.has('year')) needed.push({ name: 'Year', value: '2020' })
    if (!have.has('color')) needed.push({ name: 'Color', value: 'Red' })
    if (needed.length) {
      const rows = needed.map((n) => ({ car_id: car.id, name: n.name, value: n.value }))
      const res = await supabase.from('car_specifications').insert(rows)
      if (res.error) throw res.error
    }
  }

  // 4) Upsert customer
  const email = 'kioumars12@gmail.com'
  const firstName = 'Kiou'
  const lastName = 'You'
  const phone = '123-456-7890'
  let customer: any
  {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (data) {
      customer = data
      const up = await supabase
        .from('customers')
        .update({ first_name: firstName, last_name: lastName, phone })
        .eq('id', customer.id)
      if (up.error) throw up.error
    } else {
      const ins = await supabase
        .from('customers')
        .insert({ email, first_name: firstName, last_name: lastName, phone })
        .select('id')
        .single()
      if (ins.error) throw ins.error
      customer = ins.data
    }
  }

  // 5) Create a booking (captured payment, pending contract)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() + 7)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 3) // 4 days inclusive

  const iso = (d: Date) => d.toISOString().split('T')[0]

  const bookingInsert = await supabase
    .from('bookings')
    .insert({
      id: randomUUID(),
      car_id: car.id,
      customer_id: customer.id,
      start_date: iso(startDate),
      end_date: iso(endDate),
      total_price: 2000, // not used for Base Fee calc; included as metadata
      currency: 'USD',
      payment_status: 'captured',
      overall_status: 'pending_contract',
      contract_status: 'not_sent',
    })
    .select('id')
    .single()
  if (bookingInsert.error) throw bookingInsert.error
  const bookingId = bookingInsert.data.id

  // 6) Trigger DocuSeal contract generation
  const docuseal = getDocuSealService()
  const result = await docuseal.generateContract(bookingId)
  console.log('DocuSeal result:', result)
}

main().catch((err) => {
  console.error('Failed to send DocuSeal test contract:', err)
  process.exit(1)
})

