import { NextResponse } from "next/server"
import { getSupabaseServiceClient } from "@/lib/supabase/client"
import { BUCKET_NAMES } from "@/lib/supabase/storage-service"

// This is a one-time setup route to upload the placeholder image to Supabase
export async function GET() {
  try {
    const supabase = getSupabaseServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase client not available" }, { status: 500 })
    }

    // Check if the placeholder bucket exists, create if not
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()

    if (bucketError) {
      return NextResponse.json({ error: bucketError.message }, { status: 500 })
    }

    const generalBucket = buckets.find((bucket) => bucket.name === BUCKET_NAMES.GENERAL)

    if (!generalBucket) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAMES.GENERAL, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
      })

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }
    }

    // Fetch the placeholder image from the provided URL
    const placeholderUrl =
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%20Apr%202%2C%202025%2C%2009_34_50%20PM-NauHAGMA7F8w9gIQ7dqc9yC8aOFTjS.png"
    const response = await fetch(placeholderUrl)

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch placeholder image" }, { status: 500 })
    }

    const imageBlob = await response.blob()

    // Upload to Supabase
    const { data, error } = await supabase.storage.from(BUCKET_NAMES.GENERAL).upload("placeholder.png", imageBlob, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "31536000", // 1 year cache
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get the public URL
    const { data: urlData } = supabase.storage.from(BUCKET_NAMES.GENERAL).getPublicUrl(data.path)

    return NextResponse.json({
      success: true,
      message: "Placeholder image uploaded successfully",
      url: urlData.publicUrl,
    })
  } catch (error) {
    console.error("Error uploading placeholder:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

