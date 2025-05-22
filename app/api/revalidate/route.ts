import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-supabase-webhook-signature')
    
    if (WEBHOOK_SECRET && signature) {
      if (!signature) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    const payload = await request.json()
    
    const { type, table, record } = payload
    
    if (table === 'cars') {
      revalidatePath('/fleet')
      
      if (record?.slug) {
        revalidatePath(`/fleet/${record.slug}`)
      }
      
      revalidatePath('/')
      
      revalidatePath('/sitemap.xml')
    }
    
    return NextResponse.json({ 
      success: true, 
      revalidated: true, 
      message: `Revalidated paths for ${table} change` 
    })
  } catch (error) {
    console.error('Revalidation error:', error)
    return NextResponse.json(
      { success: false, message: 'Error revalidating' },
      { status: 500 }
    )
  }
}
