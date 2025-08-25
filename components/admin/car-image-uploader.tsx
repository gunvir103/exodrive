"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Upload, Star, Move, Trash } from "lucide-react"
import { storageService, ALLOWED_FILE_TYPES } from "@/lib/supabase/storage-service"
import { cn } from "@/lib/utils"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { restrictToParentElement } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"

interface CarImage {
  id: string
  url: string
  isPrimary: boolean
  path?: string
}

interface SortableImageProps {
  image: CarImage
  index: number
  onRemove: (id: string) => void
  onSetPrimary: (id: string) => void
}

function SortableImage({ image, index, onRemove, onSetPrimary }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: image.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group" {...attributes}>
      <div className="relative aspect-video rounded-md overflow-hidden border cursor-move" {...listeners}>
        <Image src={image.url || "/placeholder.svg"} alt={`Car image ${index + 1}`} fill className="object-cover" />
      </div>
      <div className="absolute top-2 left-2 flex gap-1">
        {image.isPrimary ? (
          <Badge className="bg-yellow-500 hover:bg-yellow-600">
            <Star className="h-3 w-3 mr-1" />
            Primary
          </Badge>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="h-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white"
            onClick={() => onSetPrimary(image.id)}
          >
            <Star className="h-3 w-3 mr-1" />
            Set Primary
          </Button>
        )}
      </div>
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
        onClick={() => onRemove(image.id)}
      >
        <Trash className="h-3 w-3" />
      </Button>
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        <Move className="h-3 w-3 inline mr-1" />
        Drag to reorder
      </div>
    </div>
  )
}

interface CarImageUploaderProps {
  carId: string
  initialImages?: CarImage[]
  onImagesChange: (images: CarImage[]) => void
  className?: string
}

export function CarImageUploader({ carId, initialImages = [], onImagesChange, className }: CarImageUploaderProps) {
  const [images, setImages] = useState<CarImage[]>(initialImages)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Convert FileList to array
    const fileArray = Array.from(files)

    // Validate file types
    const invalidFiles = fileArray.filter((file) => !ALLOWED_FILE_TYPES.IMAGES.includes(file.type))
    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: `Some files are not valid images. Allowed types: ${ALLOWED_FILE_TYPES.IMAGES.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    // Upload files
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + Math.random() * 20
          return newProgress >= 100 ? 100 : newProgress
        })
      }, 500)

      // Process files sequentially
      const newImages: CarImage[] = []

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        // Set as primary if this is the first image and there are no existing images
        const isPrimary = images.length === 0 && i === 0

        const fileInfo = await storageService.uploadCarImage(file, carId, isPrimary)

        newImages.push({
          id: fileInfo.path,
          url: fileInfo.url,
          isPrimary,
          path: fileInfo.path,
        })
      }

      clearInterval(progressInterval)
      setUploadProgress(100)

      // Update images state
      const updatedImages = [...images, ...newImages]
      setImages(updatedImages)
      onImagesChange(updatedImages)

      toast({
        title: "Upload complete",
        description: `${newImages.length} image${newImages.length !== 1 ? "s" : ""} uploaded successfully.`,
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

  const handleRemoveImage = async (id: string) => {
    try {
      const imageToRemove = images.find((img) => img.id === id)
      if (!imageToRemove) return

      // If removing the primary image, set the first remaining image as primary
      let updatedImages = images.filter((img) => img.id !== id)

      if (imageToRemove.isPrimary && updatedImages.length > 0) {
        updatedImages = updatedImages.map((img, index) => (index === 0 ? { ...img, isPrimary: true } : img))
      }

      // Delete from storage if path is available
      if (imageToRemove.path) {
        await storageService.deleteFile(storageService.BUCKET_NAMES.CARS, imageToRemove.path)
      }

      setImages(updatedImages)
      onImagesChange(updatedImages)

      toast({
        title: "Image removed",
        description: "The image has been removed successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove image",
        variant: "destructive",
      })
    }
  }

  const handleSetPrimary = (id: string) => {
    const updatedImages = images.map((img) => ({
      ...img,
      isPrimary: img.id === id,
    }))

    setImages(updatedImages)
    onImagesChange(updatedImages)

    toast({
      title: "Primary image set",
      description: "The primary image has been updated.",
    })
  }

  const handleDragEnd = useCallback(
    (event: any) => {
      const { active, over } = event

      if (active.id !== over.id) {
        setImages((items) => {
          const oldIndex = items.findIndex((item) => item.id === active.id)
          const newIndex = items.findIndex((item) => item.id === over.id)

          const newItems = [...items]
          const [removed] = newItems.splice(oldIndex, 1)
          newItems.splice(newIndex, 0, removed)

          onImagesChange(newItems)
          return newItems
        })
      }
    },
    [onImagesChange],
  )

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Car Images</h3>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToParentElement]}
          >
            <SortableContext items={images.map((img) => img.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {images.map((image, index) => (
                  <SortableImage
                    key={image.id}
                    image={image}
                    index={index}
                    onRemove={handleRemoveImage}
                    onSetPrimary={handleSetPrimary}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center",
              "hover:border-primary/50 transition-colors cursor-pointer",
              isUploading && "pointer-events-none",
            )}
            onClick={handleFileSelect}
          >
            {isUploading ? (
              <div className="text-center">
                <div className="w-full max-w-xs bg-muted rounded-full h-2.5 mb-2">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-muted-foreground">Uploading images... {Math.round(uploadProgress)}%</p>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground mb-1">Upload Images</p>
                <p className="text-xs text-muted-foreground">Drag and drop or click to select. Max 5MB per image.</p>
              </>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={ALLOWED_FILE_TYPES.IMAGES.join(",")}
            onChange={handleFileChange}
            multiple
            disabled={isUploading}
          />

          <p className="text-xs text-muted-foreground">
            Upload high-quality images of the car. The primary image will be displayed as the main image in listings.
            Drag and drop to reorder images.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

