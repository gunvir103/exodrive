"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { Session, User } from "@supabase/supabase-js"

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
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
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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
          return
        }

        if (session) {
          setSession(session)
          setUser(session.user)
        }
      } catch (error) {
        console.error("Unexpected error during getSession:", error)
        setSession(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
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
    } catch (error) {
      console.error("Error during logout:", error)
    }
  }

  const value = {
    user,
    session,
    isLoading,
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

