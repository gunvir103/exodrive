"use client"

import Image from "next/image"
import { handleImageError } from "@/lib/utils/image-utils"
import type { ImageProps } from "next/image"

export function ClientImage(props: ImageProps) {
  return <Image {...props} onError={handleImageError} />
} 