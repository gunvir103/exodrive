/**
 * Safe Structured Data Script Component
 * Provides a React component for safely rendering structured data with error boundaries
 */

'use client'

import React from 'react'
import { type BaseSchema, combineSchemas } from '@/lib/seo/structured-data'

interface StructuredDataScriptProps {
  schema: BaseSchema | BaseSchema[] | null
  fallback?: React.ReactNode
  debug?: boolean
}

// Error boundary specifically for structured data
class StructuredDataErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.debug('[Structured Data] Component error:', {
      error: error.message,
      errorInfo: errorInfo.componentStack,
    })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null
    }

    return this.props.children
  }
}

// Safe structured data script component
export function StructuredDataScript({ 
  schema, 
  fallback = null, 
  debug = false 
}: StructuredDataScriptProps): React.ReactElement | null {
  // Early return for invalid schema
  if (!schema) {
    if (debug) console.debug('[Structured Data] No schema provided')
    return fallback as React.ReactElement | null
  }

  return (
    <StructuredDataErrorBoundary fallback={fallback}>
      <SafeScriptRenderer schema={schema} debug={debug} />
    </StructuredDataErrorBoundary>
  )
}

// Internal safe script renderer
function SafeScriptRenderer({ 
  schema, 
  debug 
}: { 
  schema: BaseSchema | BaseSchema[] | null
  debug: boolean
}): React.ReactElement | null {
  try {
    if (!schema) return null

    const jsonContent = Array.isArray(schema) 
      ? combineSchemas(...schema)
      : JSON.stringify(schema, null, 2)

    // Validate JSON content
    if (!jsonContent || jsonContent === '{}' || jsonContent === '[]') {
      if (debug) console.debug('[Structured Data] Empty or invalid JSON content')
      return null
    }

    // Additional validation - try to parse the JSON to ensure it's valid
    try {
      JSON.parse(jsonContent)
    } catch (parseError) {
      console.error('[Structured Data] Invalid JSON generated:', parseError)
      return null
    }

    if (debug) {
      console.debug('[Structured Data] Rendering schema:', {
        type: Array.isArray(schema) ? 'array' : 'object',
        length: Array.isArray(schema) ? schema.length : 1,
        schemas: Array.isArray(schema) 
          ? schema.map(s => s['@type']).join(', ')
          : schema['@type']
      })
    }

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonContent }}
        suppressHydrationWarning
      />
    )
  } catch (error) {
    console.error('[Structured Data] Render error:', error)
    return null
  }
}

// Server-side safe structured data script (for SSR)
export function ServerStructuredDataScript({ 
  schema, 
  debug = false 
}: StructuredDataScriptProps): React.ReactElement | null {
  try {
    if (!schema) {
      if (debug) console.debug('[Structured Data SSR] No schema provided')
      return null
    }

    const jsonContent = Array.isArray(schema) 
      ? combineSchemas(...schema)
      : JSON.stringify(schema, null, 2)

    if (!jsonContent || jsonContent === '{}' || jsonContent === '[]') {
      if (debug) console.debug('[Structured Data SSR] Empty or invalid JSON content')
      return null
    }

    // Server-side JSON validation
    try {
      JSON.parse(jsonContent)
    } catch (parseError) {
      console.error('[Structured Data SSR] Invalid JSON generated:', parseError)
      return null
    }

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonContent }}
      />
    )
  } catch (error) {
    console.error('[Structured Data SSR] Render error:', error)
    return null
  }
}

// Hook for using structured data in React components
export function useStructuredData(
  schemaGenerator: () => BaseSchema | BaseSchema[] | null,
  dependencies: React.DependencyList = []
): {
  schema: BaseSchema | BaseSchema[] | null
  isLoading: boolean
  error: Error | null
} {
  const [schema, setSchema] = React.useState<BaseSchema | BaseSchema[] | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = schemaGenerator()
      setSchema(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown schema generation error')
      setError(error)
      console.error('[Structured Data Hook] Generation error:', error)
    } finally {
      setIsLoading(false)
    }
  }, dependencies)

  return { schema, isLoading, error }
}

// Default export for convenience
export default StructuredDataScript