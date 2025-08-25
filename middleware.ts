import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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
            // Set default security options for cookies
            const secureOptions: CookieOptions = {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              ...options,
            }

            // Update request cookies
            request.cookies.set({
              name,
              value,
              ...secureOptions,
            })
            
            // Update response cookies - don't recreate response object
            response.cookies.set({
              name,
              value,
              ...secureOptions,
            })
          } catch (error) {
            console.error(`Middleware: Failed to set cookie '${name}':`, error)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            const removeOptions: CookieOptions = {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 0,
              ...options,
            }

            // Update request cookies
            request.cookies.set({
              name,
              value: '',
              ...removeOptions,
            })
            
            // Update response cookies - don't recreate response object
            response.cookies.set({
              name,
              value: '',
              ...removeOptions,
            })
          } catch (error) {
            console.error(`Middleware: Failed to remove cookie '${name}':`, error)
          }
        },
      },
    }
  )

  try {
    // Refresh session if expired - required for Server Components
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    const { data: { user }, error } = await supabase.auth.getUser()
    
    const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
    const isAdminApiRoute = request.nextUrl.pathname.startsWith('/api/admin')
    const isAdminLoginRoute = request.nextUrl.pathname === '/admin/login'
    
    // Handle admin routes
    if ((isAdminRoute || isAdminApiRoute) && !isAdminLoginRoute) {
      if (!user) {
        // No user - redirect to login for pages, return 401 for API
        if (isAdminApiRoute) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        } else {
          const redirectUrl = new URL('/admin/login', request.url)
          redirectUrl.searchParams.set('error', 'Please+log+in+to+continue')
          return NextResponse.redirect(redirectUrl)
        }
      }
      
      // User exists but we need to check admin role
      // For now, we'll check in the route handlers themselves
      // since middleware doesn't have access to the database
    }
  } catch (error) {
    console.error('Middleware: Auth check error:', error)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}