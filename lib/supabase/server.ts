import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { createClient } from '@supabase/supabase-js'
import { getPooledServerClient, getPooledServiceClient, executeWithConnection } from '../database/client-manager'
import { SupabaseClient } from '@supabase/supabase-js'

// Server client for Server Components, Server Actions, Route Handlers
// Legacy function - will be deprecated
export function createSupabaseServerClient(cookieStore: ReadonlyRequestCookies) {
  return createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          try {
            const cookie = await cookieStore.get(name)
            return cookie?.value
          } catch (error) {
            console.error(`Error getting cookie '${name}':`, error);
            return undefined;
          }
        },
        set: async (name: string, value: string, options: CookieOptions) => {
          try {
            // Add default security options
            const secureOptions: CookieOptions = {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              ...options,
            }
            await cookieStore.set({ name, value, ...secureOptions })
          } catch (error) {
            // Log error but don't throw - middleware handles session refresh
            console.error(`Server client: Failed to set cookie '${name}':`, error)
          }
        },
        remove: async (name: string, options: CookieOptions) => {
          try {
            const removeOptions: CookieOptions = {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 0,
              ...options,
            }
            await cookieStore.set({ name, value: '', ...removeOptions })
          } catch (error) {
            // Log error but don't throw - middleware handles session refresh
            console.error(`Server client: Failed to remove cookie '${name}':`, error)
          }
        },
      },
    }
  )
}

// Enhanced server client for Route Handlers with proper response handling
export function createSupabaseRouteHandlerClient(
  request: Request,
  response?: Response
) {
  return createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // For route handlers, get cookies from request
          const cookieStore = request.headers.get('cookie') || ''
          const cookies = cookieStore.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=')
            if (key) acc[key] = value
            return acc
          }, {} as Record<string, string>)
          return cookies[name]
        },
        set(name: string, value: string, options: CookieOptions) {
          // In route handlers, we need to handle this in the response
          // This is a placeholder - actual implementation should be in the route handler
          console.warn('Cookie setting should be handled in route handler response')
        },
        remove(name: string, options: CookieOptions) {
          // In route handlers, we need to handle this in the response
          // This is a placeholder - actual implementation should be in the route handler
          console.warn('Cookie removal should be handled in route handler response')
        },
      },
    }
  )
}

// New pooled server client functions
export async function withServerClient<T>(
  cookieStore: ReadonlyRequestCookies,
  operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  return executeWithConnection(operation, 'browser', cookieStore);
}

// For cases where you need direct access (use sparingly)
export async function getPooledSupabaseServerClient(cookieStore: ReadonlyRequestCookies) {
  return getPooledServerClient(cookieStore);
}

// Server client specifically for using the Service Role Key
// Legacy function - will be deprecated
export function createSupabaseServiceRoleClient() {
    console.log("--- DEBUG: Inside createSupabaseServiceRoleClient ---");
    const supabaseUrl = process.env.SUPABASE_URL; // Correct: Use non-public URL for server-side
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // ADDED DEBUG LOGS to see the actual values:
    console.log(`--- DEBUG: process.env.SUPABASE_URL = ${supabaseUrl}`); 
    console.log(`--- DEBUG: process.env.SUPABASE_SERVICE_ROLE_KEY exists = ${!!supabaseServiceKey}`); // Log if key exists, not the key itself for security

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

// New pooled service role client functions
export async function withServiceRoleClient<T>(
  operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  return executeWithConnection(operation, 'service');
}

// For cases where you need direct access (use sparingly)
export async function getPooledSupabaseServiceClient() {
  return getPooledServiceClient();
} 