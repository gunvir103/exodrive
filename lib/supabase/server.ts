import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { createClient } from '@supabase/supabase-js'

// Server client for Server Components, Server Actions, Route Handlers
export function createSupabaseServerClient(cookieStore: ReadonlyRequestCookies) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignore errors in Server Components (middleware handles refresh)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignore errors in Server Components (middleware handles refresh)
          }
        },
      },
    }
  )
}

// Server client specifically for using the Service Role Key
// ** Using base createClient from @supabase/supabase-js **
export function createSupabaseServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // Revert back to using the public URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Remove or comment out the temporary debug logs
    // console.log(`--- DEBUG: Using URL for Service Client: ${supabaseUrl} ---`);
    
    if (!supabaseUrl || !supabaseServiceKey) {
        console.warn("Supabase service client: URL or Service Role Key missing.");
        throw new Error("Supabase URL or Service Role Key missing for service client.");
    }

    // Use the base client directly with the service key
    return createClient(
        supabaseUrl,
        supabaseServiceKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
} 