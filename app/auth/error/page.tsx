"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error") || "An authentication error occurred"

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-xl font-bold text-red-600">
            Authentication Error
          </CardTitle>
          <CardDescription>
            There was a problem with your authentication request
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{decodeURIComponent(error)}</p>
          </div>
          
          <div className="flex flex-col space-y-2">
            <Button asChild>
              <Link href="/admin/login">
                Try Again
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">
                Go to Homepage
              </Link>
            </Button>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>
              If you continue to experience issues, please contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}