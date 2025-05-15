"use client"

import { useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Car } from "lucide-react"
import { login, signup } from './actions'
import { useAuth } from "@/components/auth-provider"

// Separate component to use search params
function LoginForm() {
  const searchParams = useSearchParams()
  const errorMessage = searchParams.get('error')
  const successMessage = searchParams.get('message')

  return (
    <form className="space-y-4">
       {errorMessage && (
          <p className="text-center text-sm text-red-600 bg-red-100 p-3 rounded-md">{errorMessage}</p>
       )}
       {successMessage && (
          <p className="text-center text-sm text-green-600 bg-green-100 p-3 rounded-md">{successMessage}</p>
       )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="m@example.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button formAction={login} className="w-full">Log In</Button>
          <Button formAction={signup} variant="outline" className="w-full">Sign Up</Button>
      </div>
    </form>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/admin?auth=success")
    }
  }, [user, isLoading, router])

  if (isLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        {/* Optional: Add a loading spinner here */}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-6">
            <Car className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Admin Access</CardTitle>
          <CardDescription className="text-center">
            Sign in or create an account to manage the ExoDrive fleet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="space-y-4 animate-pulse">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="flex gap-2 pt-2">
              <div className="h-10 w-full bg-gray-200 rounded"></div>
              <div className="h-10 w-full bg-gray-200 rounded"></div>
            </div>
          </div>}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

