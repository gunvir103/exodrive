'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const cookieStore = await cookies()

  const supabase = createSupabaseServerClient(cookieStore)

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error("Login error:", error.message);
    return redirect('/admin/login?error=Could+not+authenticate+user')
  }

  return redirect('/admin')
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const cookieStore = await cookies()

  const supabase = createSupabaseServerClient(cookieStore)

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
     console.error("Signup error:", error.message);
    return redirect('/admin/login?error=Could+not+sign+up+user')
  }

  return redirect('/admin/login?message=Check+email+to+continue+sign+up+process')
} 