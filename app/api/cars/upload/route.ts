import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { BUCKET_NAMES } from "@/lib/supabase/storage-service"; // Assuming BUCKET_NAMES is defined here

// Define the bucket name (ensure it matches the one created)
const CAR_IMAGES_BUCKET = BUCKET_NAMES.VEHICLE_IMAGES || "vehicle-images"; // Use constant or fallback

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Add set and remove for type compliance, though Route Handlers can't set/remove directly
        set(name: string, value: string, options: CookieOptions) {
           // Cannot set cookies in Route Handlers, this is for type compliance
           // console.warn("Attempted to set cookie in Route Handler (not possible):", name);
           // cookieStore.set(name, value, options); // This line would error
        },
        remove(name: string, options: CookieOptions) {
           // Cannot remove cookies in Route Handlers, this is for type compliance
           // console.warn("Attempted to remove cookie in Route Handler (not possible):", name);
           // cookieStore.delete(name, options); // This line would error
        },
      },
    }
  );

  // 1. Check user authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Upload API: Auth Error:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: Check if the user has admin privileges if needed
  // const { data: profile, error: profileError } = await supabase
  //   .from('profiles') // Assuming you have a profiles table with roles
  //   .select('role')
  //   .eq('id', user.id)
  //   .single();
  // if (profileError || profile?.role !== 'admin') {
  //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // }


  // 2. Parse FormData
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // 3. Generate unique path/filename
  const fileExtension = file.name.split(".").pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = `${user.id}/${fileName}`; // Optional: Organize by user ID

  try {
    // 4. Upload file to Supabase Storage using the *service role* for elevated permissions
    // We need the service client here because bucket policies might restrict direct client uploads
    // For the service role client, we don't need cookies, but the type requires the object.
    // Provide a minimal compliant object.
    const supabaseAdmin = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key
        {
            cookies: {
                // Provide dummy methods for type compliance
                get(name: string) { return undefined; },
                set(name: string, value: string, options: CookieOptions) {},
                remove(name: string, options: CookieOptions) {},
            },
            auth: { persistSession: false } // Don't need session persistence
        }
    );

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(CAR_IMAGES_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600", // Cache for 1 hour
        upsert: false, // Don't overwrite existing files (optional)
      });

    if (uploadError) {
      console.error("Upload API: Supabase Upload Error:", uploadError);
      // Provide more specific error feedback if possible
      if (uploadError.message.includes("Bucket not found")) {
           return NextResponse.json({ error: `Storage bucket '${CAR_IMAGES_BUCKET}' not found.` }, { status: 500 });
      }
      return NextResponse.json({ error: `Failed to upload file: ${uploadError.message}` }, { status: 500 });
    }

    // 5. Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(CAR_IMAGES_BUCKET)
      .getPublicUrl(uploadData.path);

    if (!urlData?.publicUrl) {
        console.error("Upload API: Failed to get public URL for path:", uploadData.path);
        // Consider deleting the uploaded file if URL retrieval fails to avoid orphans
        // await supabaseAdmin.storage.from(CAR_IMAGES_BUCKET).remove([uploadData.path]);
        return NextResponse.json({ error: "File uploaded but failed to get public URL." }, { status: 500 });
    }

    console.log("Upload API: File uploaded successfully:", urlData.publicUrl);
    // 6. Return public URL
    return NextResponse.json({ publicUrl: urlData.publicUrl, storagePath: uploadData.path });

  } catch (error: any) {
    console.error("Upload API: General Error:", error);
    return NextResponse.json({ error: `An unexpected error occurred: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
} 