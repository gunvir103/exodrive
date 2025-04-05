"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ShieldAlert } from "lucide-react"

export function AdminLoginLink() {
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-foreground transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => router.push("/admin/login")}
    >
      <ShieldAlert className={`mr-1 h-4 w-4 ${isHovered ? "text-primary" : ""}`} />
      Admin
    </Button>
  )
}

