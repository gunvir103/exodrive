import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { BUCKET_NAMES } from "@/lib/supabase/storage-service";
import { withApiErrorHandling } from "@/lib/errors/error-middleware";
import { z } from "zod";

// Define the bucket name (ensure it matches the one created)
const CAR_IMAGES_BUCKET = BUCKET_NAMES.VEHICLE_IMAGES || "vehicle-images"; // Use constant or fallback

// Define allowed file types and size limits
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Validation schema for file upload
const FileUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, "File size must be less than 10MB")
    .refine(
      (file) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type),
      "File must be a valid image format (JPEG, PNG, or WebP)"
    )
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const cookieStore = await cookies();
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
    return NextResponse.json(
      { 
        error: "Unauthorized",
        code: "AUTH_REQUIRED"
      }, 
      { status: 401 }
    );
  }

  // Check if the user has admin privileges
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json(
      { 
        error: "Insufficient permissions",
        code: "FORBIDDEN"
      }, 
      { status: 403 }
    );
  }


  // 2. Parse FormData
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { 
        error: "No file provided",
        code: "FILE_REQUIRED"
      }, 
      { status: 400 }
    );
  }

  // Validate file
  const validation = FileUploadSchema.safeParse({ file });
  if (!validation.success) {
    return NextResponse.json(
      { 
        error: "Invalid file",
        code: "VALIDATION_ERROR",
        details: validation.error.flatten()
      }, 
      { status: 400 }
    );
  }

  // Validate file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
      { status: 400 }
    );
  }

  // 3. Generate unique path/filename with validation
  const fileExtension = file.name.split(".").pop()?.toLowerCase();
  
  // Validate extension
  if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return NextResponse.json(
      { error: `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 }
    );
  }

  // Sanitize filename - use UUID to avoid any path traversal or special characters
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = `${user.id}/${fileName}`; // Organize by user ID

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

  // Additional content verification before upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Check magic bytes for actual file type (basic check for common image formats)
  const magicBytes = buffer.subarray(0, 4).toString('hex');
  const validMagicBytes = {
    'ffd8ff': 'jpeg', // JPEG
    '89504e47': 'png', // PNG
    '52494646': 'webp' // WEBP (RIFF header)
  };
  
  let isValidContent = false;
  for (const [magic, type] of Object.entries(validMagicBytes)) {
    if (magicBytes.startsWith(magic) || (type === 'webp' && buffer.subarray(8, 12).toString('hex') === '57454250')) {
      isValidContent = true;
      break;
    }
  }
  
  if (!isValidContent) {
    return NextResponse.json(
      { error: "File content does not match allowed image types" },
      { status: 400 }
    );
  }

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(CAR_IMAGES_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600", // Cache for 1 hour
        upsert: false, // Don't overwrite existing files
        contentType: file.type // Explicitly set content type
      });

  if (uploadError) {
    console.error("[Car Upload] Storage error:", uploadError);
    
    if (uploadError.message.includes("Bucket not found")) {
      return NextResponse.json(
        { 
          error: "Storage configuration error",
          code: "STORAGE_CONFIG_ERROR"
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to upload file",
        code: "UPLOAD_FAILED"
      }, 
      { status: 500 }
    );
  }

  // 5. Get public URL
  const { data: urlData } = supabaseAdmin.storage
      .from(CAR_IMAGES_BUCKET)
      .getPublicUrl(uploadData.path);

  if (!urlData?.publicUrl) {
      console.error("[Car Upload] Failed to get public URL for path:", uploadData.path);
      // Clean up the uploaded file
      await supabaseAdmin.storage.from(CAR_IMAGES_BUCKET).remove([uploadData.path]);
      
      return NextResponse.json(
        { 
          error: "Failed to generate file URL",
          code: "URL_GENERATION_FAILED"
        }, 
        { status: 500 }
      );
  }

  // 6. Return success response
  return NextResponse.json(
    { 
      success: true,
      data: {
        publicUrl: urlData.publicUrl,
        storagePath: uploadData.path,
        fileName
      }
    },
    { status: 201 }
  );
}); 