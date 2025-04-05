"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const handleError = () => {
      setHasError(true)
    }

    // Listen for chunk loading errors
    window.addEventListener("error", (event) => {
      if (
        event.message === "Loading chunk failed" ||
        (event.target && (event.target as HTMLElement).tagName === "SCRIPT")
      ) {
        handleError()
        event.preventDefault()
      }
    })

    return () => {
      window.removeEventListener("error", handleError)
    }
  }, [])

  if (hasError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
        <p className="mb-6 text-muted-foreground max-w-md">
          We apologize for the inconvenience. Please try refreshing the page.
        </p>
        <Button
          onClick={() => {
            setHasError(false)
            window.location.reload()
          }}
          className="gradient-primary"
        >
          Refresh Page
        </Button>
      </div>
    )
  }

  return <>{children}</>
}

