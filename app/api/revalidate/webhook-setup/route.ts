import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    webhook_url: 'https://exodrive.co/api/revalidate',
    setup_instructions: [
      'Go to Supabase Dashboard > Project Settings > API',
      'Navigate to Webhooks section',
      'Create a new webhook:',
      '  - Set the URL to https://exodrive.co/api/revalidate',
      '  - Enable ON INSERT, ON UPDATE, ON DELETE events for cars table',
      '  - Set the HTTP method to POST',
      '  - Optionally set up a secret key and add it to your environment variables as SUPABASE_WEBHOOK_SECRET'
    ],
    sample_payload: {
      type: 'UPDATE',
      table: 'cars',
      record: {
        id: '123',
        slug: 'example-car',
      }
    }
  })
}
