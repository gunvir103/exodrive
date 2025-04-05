"use client"

import type React from "react"

import { useState, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { Upload, X, Play, Pause, ImageIcon, Film } from "lucide-react"
import { storageService, ALLOWED_FILE_TYPES } from "@/lib/supabase/storage-service"
import { cn } from "@/lib/utils"

interface HeroBackgroundUploaderProps {
  heroId: string
  initialType: "image" | "video"
  initialSrc?: string
  onUploadComplete: (type: "image" | "video", url: string) => void
  className?: string
}

export function HeroBackgroundUploader({
  heroId,
  initialType = "image",
  initialSrc,
  onUploadComplete,
  className,
}: HeroBackgroundUploaderProps) {
  const [backgroundType, setBackgroundType] = useState<"image" | "video">(initialType)
  const [previewSrc, setPreviewSrc] = useState<string | null>(initialSrc || null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { toast } = useToast()

  const handleTypeChange = (value: string) => {
    setBackgroundType(value as "image" | "video")
    setPreviewSrc(null) // Clear preview when changing type
  }

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = backgroundType === "image" ? ALLOWED_FILE_TYPES.IMAGES : ALLOWED_FILE_TYPES.VIDEOS

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: `Please select a ${backgroundType} file. Allowed types: ${allowedTypes.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    // Create local preview
    const objectUrl = URL.createObjectURL(file)
    setPreviewSrc(objectUrl)

    // Upload to Supabase
    try {
      setIsUploading(true)
      setUploadProgress(0)

      // Simulate upload progress (in a real app, you'd use Supabase's upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + Math.random() * 20
          return newProgress >= 100 ? 100 : newProgress
        })
      }, 500)

      const fileInfo = await storageService.uploadHeroBackground(file, heroId)

      clearInterval(progressInterval)
      setUploadProgress(100)

      // Call the callback with the new URL
      onUploadComplete(backgroundType, fileInfo.url)

      toast({
        title: "Upload complete",
        description: `${backgroundType} has been uploaded successfully.`,
      })
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const toggleVideoPlayback = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsVideoPlaying(!isVideoPlaying)
    }
  }

  const clearPreview = () => {
    setPreviewSrc(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Background Type</Label>
            <RadioGroup value={backgroundType} onValueChange={handleTypeChange} className="flex space-x-4 mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="image" id="image" />
                <Label htmlFor="image" className="flex items-center">
                  <ImageIcon className="h-4 w-4 mr-1" />
                  Image
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="video" id="video" />
                <Label htmlFor="video" className="flex items-center">
                  <Film className="h-4 w-4 mr-1" />
                  Video
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="relative">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[200px]",
                previewSrc ? "border-primary" : "border-muted-foreground/25",
              )}
            >
              {previewSrc ? (
                <>
                  {backgroundType === "image" ? (
                    <div className="relative w-full h-[200px]">
                      <Image
                        src={previewSrc || "/placeholder.svg"}
                        alt="Background preview"
                        fill
                        className="object-cover rounded-md"
                      />
                    </div>
                  ) : (
                    <div className="relative w-full h-[200px]">
                      <video
                        ref={videoRef}
                        src={previewSrc}
                        className="w-full h-full object-cover rounded-md"
                        muted
                        loop
                        playsInline
                        onClick={toggleVideoPlayback}
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70"
                        onClick={toggleVideoPlayback}
                      >
                        {isVideoPlaying ? (
                          <Pause className="h-4 w-4 text-white" />
                        ) : (
                          <Play className="h-4 w-4 text-white" />
                        )}
                      </Button>
                    </div>
                  )}
                  <Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={clearPreview}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="text-center">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">
                    {backgroundType === "image"
                      ? "Upload an image for the hero background"
                      : "Upload a video for the hero background"}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {backgroundType === "image"
                      ? "Recommended size: 1920x1080px. Max size: 5MB"
                      : "Recommended format: MP4. Max size: 50MB"}
                  </p>
                  <Button variant="outline" onClick={handleFileSelect} disabled={isUploading}>
                    {isUploading ? "Uploading..." : "Select File"}
                  </Button>
                </div>
              )}
            </div>

            {isUploading && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                <p className="mb-2 font-medium">Uploading {backgroundType}...</p>
                <div className="w-full max-w-xs bg-muted rounded-full h-2.5 mb-2">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</p>
              </div>
            )}
          </div>

          {!previewSrc && (
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept={
                backgroundType === "image" ? ALLOWED_FILE_TYPES.IMAGES.join(",") : ALLOWED_FILE_TYPES.VIDEOS.join(",")
              }
              onChange={handleFileChange}
            />
          )}

          {previewSrc && !isUploading && (
            <Button variant="outline" onClick={handleFileSelect} className="w-full">
              Change {backgroundType}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

