"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { Session, User } from "@supabase/supabase-js"
import { AUTH_CONFIG } from "@/lib/config/auth.config"
import { logger } from "@/lib/utils/logger"
import { adminCache } from "@/lib/utils/admin-cache"
import type { AuthContextType, ProfileQueryResult, ProfileData } from "@/lib/types/auth.types"

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
  const authLogger = logger.child('AuthProvider')

  // Helper function to check admin status with caching
  const checkAdminStatus = async (userId: string, userMetadata?: any): Promise<boolean> => {
    try {
      // Check cache first
      const cachedStatus = adminCache.get(userId)
      if (cachedStatus !== null) {
        authLogger.debug('Using cached admin status', { userId, isAdmin: cachedStatus })
        return cachedStatus
      }
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<ProfileQueryResult>((_, reject) => 
        setTimeout(() => reject(new Error('Admin check timeout')), AUTH_CONFIG.TIMEOUTS.PROFILE_QUERY)
      )
      
      // Check profiles table for admin role (secure approach)
      const profilePromise = supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single() as Promise<ProfileQueryResult>
      
      const result: ProfileQueryResult = await Promise.race([
        profilePromise,
        timeoutPromise
      ]).catch((err) => {
        authLogger.error('Profile query failed or timed out', err)
        return { data: null, error: { message: err.message, code: err.code } }
      })
      
      if (result.error) {
        authLogger.warn('Error checking profile, falling back to metadata', { 
          error: result.error.message 
        })
        // Fallback to metadata check for backward compatibility
        const metadataIsAdmin = userMetadata?.role === 'admin'
        if (metadataIsAdmin) {
          authLogger.warn('User has admin in metadata but not in profiles table - needs migration')
        }
        return metadataIsAdmin || false
      }
      
      const profileData = result.data as ProfileData | null
      const isAdminUser = profileData?.role === 'admin'
      
      // Cache the result
      adminCache.set(userId, isAdminUser)
      
      authLogger.debug('Admin status determined', { userId, isAdmin: isAdminUser })
      
      return isAdminUser
    } catch (error) {
      authLogger.error('Unexpected error checking admin status', error)
      // Fallback to metadata as last resort
      return userMetadata?.role === 'admin' || false
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
          authLogger.error('Error getting session', error)
          setSession(null)
          setUser(null)
          setIsAdmin(false)
          return
        }

        if (session) {
          setSession(session)
          setUser(session.user)
          
          authLogger.debug('User session found', {
            email: session.user.email,
            id: session.user.id
          })
          
          // Check admin status
          const adminStatus = await checkAdminStatus(session.user.id, session.user.user_metadata)
          setIsAdmin(adminStatus)
        } else {
          setSession(null)
          setUser(null)
          setIsAdmin(false)
        }
      } catch (error) {
        authLogger.error('Unexpected error during getSession', error)
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
      authLogger.debug('Auth state changed', {
        event,
        hasSession: !!session,
        email: session?.user?.email
      })
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Check admin status on auth state change
        const adminStatus = await checkAdminStatus(session.user.id, session.user.user_metadata)
        setIsAdmin(adminStatus)
      } else {
        setIsAdmin(false)
        // Clear cache for logged out user
        if (user?.id) {
          adminCache.invalidate(user.id)
        }
      }
      
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const login = async (email: string, password: string) => {
    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      return {
        error,
        success: !error,
        user: data?.user,
        session: data?.session,
      }
    } catch (error) {
      authLogger.error('Unexpected error during login', error)
      return {
        error: error as Error,
        success: false,
      }
    }
  }

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        authLogger.error('Error logging out', error)
      }
      // Clear admin cache on logout
      if (user?.id) {
        adminCache.invalidate(user.id)
      }
      // Reset admin status on logout
      setIsAdmin(false)
    } catch (error) {
      authLogger.error('Error during logout', error)
    }
  }

  const value: AuthContextType = {
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