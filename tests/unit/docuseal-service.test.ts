import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createMockSupabaseClient } from '@/tests/mocks/supabase'
import { DocuSealService } from '@/lib/services/docuseal-service'

describe('DocuSealService.generateContract', () => {
  const mockBookingId = 'booking-123'

  const mockBooking = {
    id: mockBookingId,
    start_date: '2025-07-10',
    end_date: '2025-07-12',
    total_price: 300,
    currency: 'USD',
    customer_id: 'cust-1',
    car_id: 'car-1',
    // No contract_submission_id to simulate new contract
    customers: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com', phone: '+1234567890' },
    cars: { name: 'Ferrari 488' },
  }

  let updatePayload: any | null = null
  let insertEventPayload: any | null = null
  let mockClient: any

  beforeEach(() => {
    // Set required env vars
    process.env.DOCUSEAL_API_URL = 'https://docuseal.local'
    process.env.DOCUSEAL_API_TOKEN = 'test-token'
    process.env.DOCUSEAL_TEMPLATE_ID = '999'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://local.supabase'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase-key'
    process.env.COMPANY_EMAIL = 'contracts@example.com'

    // Reset captured payloads
    updatePayload = null
    insertEventPayload = null

    // Wire mock supabase APIs
    mockClient = createMockSupabaseClient()

    // Bookings select -> returns mock booking
    const bookingsChain = {
      eq: (/* col, val */) => ({
        single: async () => ({ data: mockBooking, error: null }),
      }),
    }
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'bookings') {
        return {
          select: () => bookingsChain,
          update: (payload: any) => ({
            eq: async () => {
              updatePayload = payload
              return { data: null, error: null }
            },
          }),
        }
      }
      if (table === 'car_pricing') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { base_price: 100 }, error: null }),
            }),
          }),
        }
      }
      if (table === 'car_specifications') {
        return {
          select: () => ({
            eq: () => ({
              then: (resolve: any) => resolve({ data: [
                { name: 'Make', value: 'Ferrari' },
                { name: 'Model', value: '488' },
                { name: 'Year', value: '2020' },
                { name: 'Color', value: 'Red' },
              ], error: null })
            }),
          }),
        }
      }
      if (table === 'booking_events') {
        return {
          insert: async (payload: any) => {
            insertEventPayload = Array.isArray(payload) ? payload[0] : payload
            return { data: null, error: null }
          },
        }
      }
      return {}
    })

    // Mock fetch for DocuSeal API
    global.fetch = (async (url: any, init?: any) => {
      if (typeof url === 'string' && url.endsWith('/api/submissions') && init?.method === 'POST') {
        ;(global as any).__lastDocuSealPayload = init.body
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 12345, slug: 'subm-abc', source: 'api', submitters: [], template: { id: 999, name: 'Rental' }, created_at: '', updated_at: '' }),
        } as any
      }
      return { ok: false, status: 404, text: async () => 'not found' } as any
    }) as any
  })

  afterEach(() => {
    updatePayload = null
    insertEventPayload = null
  })

  test('creates DocuSeal submission and updates booking', async () => {
    const service = new DocuSealService(
      process.env.DOCUSEAL_API_URL!,
      process.env.DOCUSEAL_API_TOKEN!,
      process.env.DOCUSEAL_TEMPLATE_ID!,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      mockClient as any,
    )
    const result = await service.generateContract(mockBookingId)

    expect(result.success).toBe(true)
    expect(result.submissionId).toBe('12345')

    // Verify DocuSeal API was called with expected payload
    // We can't inspect calls with Bun's simple function; verify payload via update/assertions
    const sent = JSON.parse((global as any).__lastDocuSealPayload ?? JSON.stringify({ template_id: 999 }))
    expect(sent.template_id).toBe(999)
    expect(sent.submitters).toHaveLength(2)
    expect(sent.submitters[0].email).toBe('contracts@example.com')
    expect(sent.submitters[1].email).toBe('jane@example.com')
    expect(sent.metadata.booking_id).toBe(mockBookingId)
    expect(sent.metadata.total_amount).toBe(300)

    // Verify booking update (contract_submission_id + status sent)
    expect(updatePayload).toBeTruthy()
    expect(updatePayload.contract_submission_id).toBe('12345')
    expect(updatePayload.contract_status).toBe('sent')

    // Verify booking event logged
    expect(insertEventPayload).toBeTruthy()
    expect(insertEventPayload.event_type).toBe('contract_sent')
  })
})
