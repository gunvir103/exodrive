import { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Instagram } from "lucide-react"

export const metadata: Metadata = {
  title: "Policies | ExoDrive Exotics",
  description: "Our rental policies and terms of service for ExoDrive Exotics.",
}

export default function PoliciesPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h1 className="text-4xl font-bold mb-4">Policies</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Check back later - our policies page is still in progress.
        </p>
        <Button asChild className="button-apple">
          <a
            href="https://www.instagram.com/exodriveexotics/?igsh=MTNwNzQ3a3c1a2xieQ%3D%3D#"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Instagram className="mr-2 h-4 w-4" />
            Temporary Policies Listed Here
          </a>
        </Button>
      </div>
    </div>
  )
} 