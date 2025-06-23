"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { Session, User } from "@supabase/supabase-js"

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAdmin: boolean
  login: (
    email: string,
    password: string,
  ) => Promise<{
    error: Error | null
    success: boolean
  }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Helper function to check admin status
  const checkAdminStatus = async (userId: string, userMetadata?: any): Promise<boolean> => {
    try {
      // First check user metadata (immediate)
      if (userMetadata?.role === 'admin') {
        console.log('Admin status confirmed via user metadata')
        return true
      }
      
      // Then check customers table (note: customers table doesn't have a role field)
      // Since customers table doesn't have role field, we rely on user metadata
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('Error checking customer existence:', error)
      }
      
      // Admin status is determined by user metadata only
      return userMetadata?.role === 'admin'
    } catch (error) {
      console.error('Unexpected error checking admin status:', error)
      // Fall back to metadata check
      return userMetadata?.role === 'admin'
    }
  }

  useEffect(() => {
    const getSession = async () => {
      setIsLoading(true)
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (error) {
          console.error("Error getting session:", error)
          setSession(null)
          setUser(null)
          setIsAdmin(false)
          return
        }

        if (session) {
          setSession(session)
          setUser(session.user)
          
          console.log('AuthProvider: User session found:', {
            email: session.user.email,
            id: session.user.id,
            metadata: session.user.user_metadata,
            role_in_metadata: session.user.user_metadata?.role
          })
          
          // Check admin status
          const adminStatus = await checkAdminStatus(session.user.id, session.user.user_metadata)
          console.log('AuthProvider: Admin status determined:', adminStatus)
          setIsAdmin(adminStatus)
        } else {
          setSession(null)
          setUser(null)
          setIsAdmin(false)
        }
      } catch (error) {
        console.error("Unexpected error during getSession:", error)
        setSession(null)
        setUser(null)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthProvider: Auth state changed:', event, {
        hasSession: !!session,
        email: session?.user?.email,
        metadata: session?.user?.user_metadata
      })
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Check admin status on auth state change
        const adminStatus = await checkAdminStatus(session.user.id, session.user.user_metadata)
        console.log('AuthProvider: Admin status on state change:', adminStatus)
        setIsAdmin(adminStatus)
      } else {
        setIsAdmin(false)
      }
      
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const login = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      return {
        error,
        success: !error,
      }
    } catch (error) {
      console.error("Unexpected error during login:", error)
      return {
        error: error as Error,
        success: false,
      }
    }
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
      // Reset admin status on logout
      setIsAdmin(false)
    } catch (error) {
      console.error("Error during logout:", error)
    }
  }

  const value = {
    user,
    session,
    isLoading,
    isAdmin,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

