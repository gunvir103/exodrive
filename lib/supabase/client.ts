import { createBrowserClient } from '@supabase/ssr'
import { getPooledBrowserClient, executeWithConnection } from '../database/client-manager'
import { SupabaseClient } from '@supabase/supabase-js'

// Create a singleton client instance for the browser (legacy support)
let client: ReturnType<typeof createBrowserClient> | undefined;

// Legacy function - will be deprecated
export function getSupabaseBrowserClient() {
  if (client) {
    return client;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase browser client: URL or Anon Key is missing.");
    throw new Error("Supabase URL or Anon Key missing in environment variables.");
  }

  client = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );

  return client;
}

// Add this export for backward compatibility
export const getSupabaseClient = getSupabaseBrowserClient;

// New pooled client functions
export async function withSupabaseClient<T>(
  operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  return executeWithConnection(operation, 'browser');
}

// For cases where you need direct access (use sparingly)
export async function getPooledSupabaseClient() {
  return getPooledBrowserClient();
}

// Helper function for creating a Supabase client with service role (admin access)
// Legacy function - will be deprecated
export function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("Supabase URL or service role key are missing.")
    return null
  }

  return createBrowserClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// New pooled service client functions
export async function withServiceClient<T>(
  operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  return executeWithConnection(operation, 'service');
}

// Helper function for handling Supabase errors
export const handleSupabaseError = (error: unknown): string => {
  console.error("Supabase error:", error)
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return (error as { message: string }).message
  }
  return "An unexpected error occurred"
}

