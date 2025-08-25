import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
      // Create a NextResponse to handle cookies properly
      let response = NextResponse.redirect(new URL('/admin', request.url))
      
      const supabase = createServerClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set(name: string, value: string, options: CookieOptions) {
              try {
                // Set cookies with security options
                const secureOptions: CookieOptions = {
                  httpOnly: true,
                  secure: process.env.NODE_ENV === 'production',
                  sameSite: 'lax',
                  path: '/',
                  ...options,
                }
                response.cookies.set({
                  name,
                  value,
                  ...secureOptions,
                })
              } catch (error) {
                console.error(`Auth callback: Failed to set cookie '${name}':`, error)
              }
            },
            remove(name: string, options: CookieOptions) {
              try {
                // Remove cookies by setting them to empty with expired date
                const removeOptions: CookieOptions = {
                  httpOnly: true,
                  secure: process.env.NODE_ENV === 'production',
                  sameSite: 'lax',
                  path: '/',
                  maxAge: 0,
                  ...options,
                }
                response.cookies.set({
                  name,
                  value: '',
                  ...removeOptions,
                })
              } catch (error) {
                console.error(`Auth callback: Failed to remove cookie '${name}':`, error)
              }
            },
          },
        }
      )

      const { error, data } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(new URL('/auth/error?error=' + encodeURIComponent(error.message), request.url))
      }

      // Log successful authentication for debugging
      if (data?.session?.user) {
        console.log('Auth callback successful for user:', data.session.user.email)
      }

      return response
    }

    // No code parameter, redirect to login
    return NextResponse.redirect(new URL('/admin/login', request.url))
  } catch (error) {
    console.error('Auth callback unexpected error:', error)
    return NextResponse.redirect(new URL('/auth/error?error=' + encodeURIComponent('Unexpected authentication error'), request.url))
  }
} 