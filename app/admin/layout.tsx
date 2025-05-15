"use client"

import { type ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Car, Grid, LogOut, Settings, Users, Home, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthProvider, useAuth } from "@/components/auth-provider"

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const authParam = searchParams.get('auth');
    const isAuthSuccess = authParam === 'success';
    
    if (!isLoading) {
      if (!user && pathname !== "/admin/login") {
        if (isAuthSuccess) {
          console.log("AdminLayout: Auth success param detected, waiting for auth state to update.")
          const timer = setTimeout(() => {
            if (!user) {
              console.log("AdminLayout: Auth state not updated after wait, redirecting to login.")
              setShouldRedirect(true)
              setPermissionDenied(false)
            }
          }, 1000); // 1 second grace period
          
          return () => clearTimeout(timer);
        } else {
          console.log("AdminLayout: No user found, redirecting to login.")
          setShouldRedirect(true)
          setPermissionDenied(false)
        }
      } else if (user && user.user_metadata?.role !== 'admin') {
        console.log(`AdminLayout: User ${user.email} is not admin, setting permission denied.`)
        setPermissionDenied(true) 
        setShouldRedirect(false)
      } else {
        setPermissionDenied(false)
        setShouldRedirect(false)
      }
    }
  }, [user, isLoading, pathname])

  useEffect(() => {
    if (shouldRedirect) {
      router.push("/admin/login")
    } else if (permissionDenied) {
      console.log("AdminLayout: Redirecting non-admin user to homepage.")
      router.push("/")
    } else {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has('auth') && user) {
        searchParams.delete('auth');
        const newQuery = searchParams.toString();
        const newPath = window.location.pathname + (newQuery ? `?${newQuery}` : '');
        router.replace(newPath, { scroll: false });
      }
    }
  }, [shouldRedirect, permissionDenied, router, user])

  if (pathname === "/admin/login") {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (!user || permissionDenied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden md:flex w-64 flex-col bg-background border-r">
        <div className="p-6 border-b">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-xl">
            <Car className="h-6 w-6" />
            <span>exoDrive Admin</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/admin">
            <Button variant="ghost" className={`w-full justify-start ${pathname === "/admin" ? "bg-muted" : ""}`}>
              <Grid className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/cars">
            <Button
              variant="ghost"
              className={`w-full justify-start ${pathname?.startsWith("/admin/cars") ? "bg-muted" : ""}`}
            >
              <Car className="mr-2 h-4 w-4" />
              Cars
            </Button>
          </Link>
          <Link href="/admin/bookings">
            <Button
              variant="ghost"
              className={`w-full justify-start ${pathname?.startsWith("/admin/bookings") ? "bg-muted" : ""}`}
            >
              <Users className="mr-2 h-4 w-4" />
              Bookings
            </Button>
          </Link>
          <Link href="/admin/settings">
            <Button
              variant="ghost"
              className={`w-full justify-start ${pathname?.startsWith("/admin/settings") ? "bg-muted" : ""}`}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
          <Link href="/admin/hero-settings">
            <Button
              variant="ghost"
              className={`w-full justify-start ${pathname?.startsWith("/admin/hero-settings") ? "bg-muted" : ""}`}
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Hero Settings
            </Button>
          </Link>
          <Link href="/admin/homepage-settings">
            <Button
              variant="ghost"
              className={`w-full justify-start ${pathname?.startsWith("/admin/homepage-settings") ? "bg-muted" : ""}`}
            >
              <Home className="mr-2 h-4 w-4" />
              Homepage Settings
            </Button>
          </Link>
        </nav>
        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b bg-background flex items-center px-6">
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-muted-foreground">Welcome, {user.email}</span>}
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AuthProvider>
  )
}

