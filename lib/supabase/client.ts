import { createBrowserClient } from '@supabase/ssr'

// Create a singleton client instance for the browser
let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (client) {
    return client;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase browser client: URL or Anon Key is missing.");
    // Returning null might be better than throwing, depending on usage
    // For now, let's throw to make it obvious during development
    throw new Error("Supabase URL or Anon Key missing in environment variables.");
  }

  client = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );

  return client;
}

// Helper function for creating a Supabase client with service role (admin access)
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

