import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { BUCKET_NAMES } from "@/lib/supabase/storage-service"; // Ensure this path is correct

const CAR_IMAGES_BUCKET = BUCKET_NAMES.VEHICLE_IMAGES || "vehicle-images";

export async function POST(request: Request) {
  const cookieStore = cookies(); // Directly get the ReadonlyRequestCookies object

  // 1. Check user authentication (using standard client)
  const supabaseUserClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Linter might still incorrectly flag this, but it's the standard pattern
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Route Handlers can't set cookies, this is for type compliance.
          // Middleware should handle auth refresh.
          try { cookieStore.set({ name, value, ...options }); } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          // Route Handlers can't set cookies, this is for type compliance.
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabaseUserClient.auth.getUser();

  if (authError || !user) {
    console.error("Delete Image API: Auth Error:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add Admin Role Check here if necessary
  // const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  // if (profile?.role !== 'admin') {
  //    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // }

  // 2. Parse request body for storagePath
  let storagePath: string;
  try {
    const body = await request.json();
    storagePath = body.storagePath;
    if (!storagePath || typeof storagePath !== 'string') {
        throw new Error("Missing or invalid 'storagePath' in request body.");
    }
  } catch (error: any) {
    console.error("Delete Image API: Error parsing request body:", error);
    return NextResponse.json({ error: `Invalid request body: ${error.message}` }, { status: 400 });
  }

  // 3. Use Service Role Client for deletion
  const supabaseAdminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key
      {
          cookies: {
              // Provide dummy/no-op methods for service role client
              get(name: string) { return undefined; },
              set(name: string, value: string, options: CookieOptions) {},
              remove(name: string, options: CookieOptions) {},
          },
          auth: { persistSession: false } // Don't need session persistence
      }
  );

  try {
    const { data, error: deleteError } = await supabaseAdminClient.storage
      .from(CAR_IMAGES_BUCKET)
      .remove([storagePath]); // Pass path in an array

    if (deleteError) {
      console.error("Delete Image API: Supabase Delete Error:", deleteError);
      // Check for specific errors if needed, e.g., Object not found
      if (deleteError.message.includes("Not Found")) {
          console.warn(`Delete Image API: Storage object not found: ${storagePath}. Proceeding as success.`);
          // Optional: Treat "Not Found" as success if the goal is just to ensure it's gone
          return NextResponse.json({ success: true, message: "Image not found in storage, considered deleted." });
      }
      return NextResponse.json({ error: `Failed to delete image: ${deleteError.message}` }, { status: 500 });
    }

    console.log("Delete Image API: Image deleted successfully:", storagePath, data);
    // 4. Return success response
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Delete Image API: General Error:", error);
    return NextResponse.json({ error: `An unexpected error occurred: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}

// Optional: Implement DELETE handler if preferred semantically,
// but POST is often easier when sending JSON body.
// export async function DELETE(request: Request) { ... same logic ... } 