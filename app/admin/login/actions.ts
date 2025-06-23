'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  // Validate inputs
  if (!email || !password) {
    redirect('/admin/login?error=Email+and+password+are+required')
  }
  
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient(cookieStore)

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error("Login error:", error.message)
    
    // Provide more specific error messages
    let errorMessage = 'Could+not+authenticate+user'
    if (error.message.includes('Invalid login credentials')) {
      errorMessage = 'Invalid+email+or+password'
    } else if (error.message.includes('Email not confirmed')) {
      errorMessage = 'Please+confirm+your+email+address'
    } else if (error.message.includes('Too many requests')) {
      errorMessage = 'Too+many+login+attempts.+Please+try+again+later'
    }
    
    redirect(`/admin/login?error=${errorMessage}`)
  }

  // Verify user has admin role before allowing access
  if (data.user) {
    // Check user metadata for admin role
    const isAdmin = data.user.user_metadata?.role === 'admin'
    
    console.log(`Login attempt by ${data.user.email}:`, {
      metadata: data.user.user_metadata,
      role: data.user.user_metadata?.role,
      isAdmin
    })
    
    if (!isAdmin) {
      console.error(`Login attempt by non-admin user: ${data.user.email}`)
      await supabase.auth.signOut() // Sign them out immediately
      redirect('/admin/login?error=Access+denied.+Admin+privileges+required')
    }
    
    console.log(`Admin login successful: ${data.user.email}`)
  }

  redirect('/admin')
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  // Validate inputs
  if (!email || !password) {
    redirect('/admin/login?error=Email+and+password+are+required')
  }
  
  // Basic password validation
  if (password.length < 6) {
    redirect('/admin/login?error=Password+must+be+at+least+6+characters')
  }
  
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
    console.error("Signup error:", error.message)
    
    // Provide more specific error messages
    let errorMessage = 'Could+not+sign+up+user'
    if (error.message.includes('User already registered')) {
      errorMessage = 'An+account+with+this+email+already+exists'
    } else if (error.message.includes('Password should be')) {
      errorMessage = 'Password+does+not+meet+requirements'
    } else if (error.message.includes('Invalid email')) {
      errorMessage = 'Please+enter+a+valid+email+address'
    }
    
    redirect(`/admin/login?error=${errorMessage}`)
  }

  redirect('/admin/login?message=Check+email+to+continue+sign+up+process')
}