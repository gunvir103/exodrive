"use client"

import { useAuth } from "@/components/auth-provider"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestAuthDebugPage() {
  const { user, isAdmin, isLoading } = useAuth()
  const [debugData, setDebugData] = useState<any>(null)
  
  useEffect(() => {
    if (!isLoading && user) {
      fetch('/api/admin/debug-auth')
        .then(res => res.json())
        .then(data => setDebugData(data))
        .catch(err => console.error('Debug fetch error:', err))
    }
  }, [user, isLoading])
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Auth Debug Page</h1>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Client-Side Auth State</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded overflow-auto text-sm">
              {JSON.stringify({
                isLoading,
                isAdmin,
                user: user ? {
                  id: user.id,
                  email: user.email,
                  metadata: user.user_metadata,
                  role_in_metadata: user.user_metadata?.role
                } : null
              }, null, 2)}
            </pre>
          </CardContent>
        </Card>
        
        {debugData && (
          <Card>
            <CardHeader>
              <CardTitle>Server-Side Auth Check</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded overflow-auto text-sm">
                {JSON.stringify(debugData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Auth Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>Logged In:</strong> {user ? 'Yes' : 'No'}</p>
            <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
            <p><strong>Role in Metadata:</strong> {user?.user_metadata?.role || 'None'}</p>
            <p><strong>Is Admin (Client):</strong> {isAdmin ? 'Yes' : 'No'}</p>
            <p><strong>Should Be Admin:</strong> {user?.user_metadata?.role === 'admin' ? 'Yes' : 'No'}</p>
          </CardContent>
        </Card>
        
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
          <Button onClick={() => window.location.href = '/admin'}>
            Go to Admin
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/admin/login'}>
            Go to Login
          </Button>
        </div>
      </div>
    </div>
  )
}