import { getSupabaseClient, handleSupabaseError } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"
import { DEFAULT_PLACEHOLDER_IMAGE } from "@/lib/utils/image-utils"
import { FileObject } from '@supabase/storage-js'

// Define bucket names
export const BUCKET_NAMES = {
  CARS: "cars",
  HERO: "hero",
  PROFILES: "profiles",
  GENERAL: "general",
  VEHICLE_IMAGES: "vehicle-images",
}

// Define allowed file types
export const ALLOWED_FILE_TYPES = {
  IMAGES: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  VIDEOS: ["video/mp4", "video/webm", "video/quicktime"],
  DOCUMENTS: ["application/pdf"],
}

// Define max file sizes (in bytes)
export const MAX_FILE_SIZES = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  VIDEO: 50 * 1024 * 1024, // 50MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
}

export interface UploadOptions {
  bucket?: string
  folder?: string
  fileType?: string[]
  maxSize?: number
  metadata?: Record<string, string>
  upsert?: boolean
  cacheControl?: string
}

export interface FileInfo {
  name: string
  path: string
  url: string
  size: number
  type: string
  metadata?: Record<string, string>
}

export const storageService = {
  /**
   * Upload a file to Supabase Storage
   */
  uploadFile: async (file: File, options: UploadOptions = {}): Promise<FileInfo> => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error("Supabase client not available")
    }

    const {
      bucket = BUCKET_NAMES.GENERAL,
      folder = "",
      fileType = ALLOWED_FILE_TYPES.IMAGES,
      maxSize = MAX_FILE_SIZES.IMAGE,
      metadata = {},
      upsert = false,
      cacheControl = "3600",
    } = options

    // Validate file type
    if (!fileType.includes(file.type)) {
      throw new Error(`Invalid file type. Allowed types: ${fileType.join(", ")}`)
    }

    // Validate file size
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`)
    }

    // Generate a unique file name
    const fileExt = file.name.split(".").pop()
    const fileName = `${uuidv4()}.${fileExt}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    try {
      // Upload the file
      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
        upsert,
        contentType: file.type,
        cacheControl,
        ...metadata,
      })

      if (error) throw error

      // Get the public URL for the file
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data?.path || filePath)

      return {
        name: fileName,
        path: data?.path || filePath,
        url: publicUrlData.publicUrl,
        size: file.size,
        type: file.type,
        metadata,
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  },

  /**
   * Upload a hero background (image or video)
   */
  uploadHeroBackground: async (file: File, heroId: string): Promise<FileInfo> => {
    const isVideo = file.type.startsWith("video/")

    return storageService.uploadFile(file, {
      bucket: BUCKET_NAMES.HERO,
      folder: heroId,
      fileType: isVideo ? ALLOWED_FILE_TYPES.VIDEOS : ALLOWED_FILE_TYPES.IMAGES,
      maxSize: isVideo ? MAX_FILE_SIZES.VIDEO : MAX_FILE_SIZES.IMAGE,
      metadata: {
        heroId,
        type: isVideo ? "video" : "image",
      },
      upsert: true,
      cacheControl: "86400", // 24 hours
    })
  },

  /**
   * Upload a car image
   */
  uploadCarImage: async (file: File, carId: string, isPrimary = false): Promise<FileInfo> => {
    return storageService.uploadFile(file, {
      bucket: BUCKET_NAMES.CARS,
      folder: carId,
      fileType: ALLOWED_FILE_TYPES.IMAGES,
      metadata: {
        carId,
        isPrimary: isPrimary.toString(),
      },
      cacheControl: "86400", // 24 hours
    })
  },

  /**
   * Get a file from Supabase Storage
   */
  getFileUrl: (bucket: string, filePath: string): string => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return DEFAULT_PLACEHOLDER_IMAGE
    }

    try {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
      return data.publicUrl
    } catch (error) {
      console.error("Error getting file URL:", error)
      return DEFAULT_PLACEHOLDER_IMAGE
    }
  },

  /**
   * Delete a file from Supabase Storage
   */
  deleteFile: async (bucket: string, filePath: string): Promise<void> => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error("Supabase client not available")
    }

    try {
      const { error } = await supabase.storage.from(bucket).remove([filePath])

      if (error) throw error
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  },

  /**
   * List files in a bucket/folder
   */
  listFiles: async (bucket: string, folder = ""): Promise<{ name: string; url: string }[]> => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error("Supabase client not available")
    }

    try {
      const { data, error } = await supabase.storage.from(bucket).list(folder)

      if (error) throw error

      // Get public URLs for all files
      return data
        .filter((item: FileObject) => !item.id)
        .map((file: FileObject) => {
          const path = folder ? `${folder}/${file.name}` : file.name
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)

          return {
            name: file.name,
            url: urlData.publicUrl,
          }
        })
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  },
}

