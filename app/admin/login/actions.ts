'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const cookieStore = cookies()
  const supabase = createSupabaseServerClient(cookieStore)

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error("Login error:", error.message);
    // Redirect back to login page with an error message
    // Consider adding query params for error display
    return redirect('/admin/login?error=Could+not+authenticate+user')
  }

  // Redirect to admin dashboard on successful login
  return redirect('/admin')
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const cookieStore = cookies()
  const supabase = createSupabaseServerClient(cookieStore)

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Ensure your env var is set if using this
      emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
     console.error("Signup error:", error.message);
    // Redirect back to login page with an error message
    return redirect('/admin/login?error=Could+not+sign+up+user')
  }

  // Redirect or show a message to check email for confirmation
  // For now, redirecting back with a success message (needs UI handling)
  return redirect('/admin/login?message=Check+email+to+continue+sign+up+process')
} 