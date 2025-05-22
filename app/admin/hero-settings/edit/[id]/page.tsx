"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { heroContentService } from "@/lib/services/hero-content-service"
import type { HeroContentData } from "@/contexts/hero-content-context"
import { ArrowLeft, Save, Trash } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export default function EditHeroPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [heroContent, setHeroContent] = useState<HeroContentData | null>(null)

  // Fetch hero content by ID
  useEffect(() => {
    const fetchHero = async () => {
      try {
        // Get all heroes and find the one with matching ID
        const heroes = await heroContentService.getAllHeroes()
        const hero = heroes.find((h) => h.id === params.id)

        if (!hero) {
          toast({
            title: "Error",
            description: "Hero content not found",
            variant: "destructive",
          })
          router.push("/admin/hero-settings")
          return
        }

        setHeroContent(hero)
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load hero content",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchHero()
  }, [params.id, router, toast])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const formData = new FormData(e.currentTarget)

      const updatedHero: Partial<HeroContentData> = {
        title: formData.get("title") as string,
        subtitle: formData.get("subtitle") as string,
        backgroundType: formData.get("backgroundType") as "image" | "video",
        backgroundSrc: formData.get("backgroundSrc") as string,
        badgeText: formData.get("badgeText") as string,
        primaryButtonText: formData.get("primaryButtonText") as string,
        primaryButtonLink: formData.get("primaryButtonLink") as string,
        secondaryButtonText: formData.get("secondaryButtonText") as string,
        secondaryButtonLink: formData.get("secondaryButtonLink") as string,
        isActive: formData.get("isActive") === "on",
      }

      await heroContentService.updateHero(params.id as string, updatedHero)

      toast({
        title: "Success",
        description: "Hero content updated successfully",
      })

      router.push("/admin/hero-settings")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update hero content",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this hero content?")) return

    try {
      await heroContentService.deleteHero(params.id as string)

      toast({
        title: "Success",
        description: "Hero content deleted successfully",
      })

      router.push("/admin/hero-settings")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete hero content",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="ghost" className="mr-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Skeleton className="h-8 w-40" />
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!heroContent) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => router.back()} className="mr-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Edit Hero Content</h1>
        </div>

        <Button variant="destructive" onClick={handleDelete}>
          <Trash className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Hero Content Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={heroContent.title} required />
                <p className="text-xs text-muted-foreground">
                  Use * around words to highlight them with a gradient (e.g., *Dream Car*)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Textarea id="subtitle" name="subtitle" defaultValue={heroContent.subtitle} required />
              </div>

              <div className="space-y-2">
                <Label>Background Type</Label>
                <RadioGroup defaultValue={heroContent.backgroundType} name="backgroundType" className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="image" id="image" />
                    <Label htmlFor="image">Image</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="video" id="video" />
                    <Label htmlFor="video">Video</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="backgroundSrc">Background Source URL</Label>
                <Input id="backgroundSrc" name="backgroundSrc" defaultValue={heroContent.backgroundSrc} required />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="badgeText">Badge Text</Label>
                <Input id="badgeText" name="badgeText" defaultValue={heroContent.badgeText} required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryButtonText">Primary Button Text</Label>
                  <Input
                    id="primaryButtonText"
                    name="primaryButtonText"
                    defaultValue={heroContent.primaryButtonText}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryButtonLink">Primary Button Link</Label>
                  <Input
                    id="primaryButtonLink"
                    name="primaryButtonLink"
                    defaultValue={heroContent.primaryButtonLink}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="secondaryButtonText">Secondary Button Text</Label>
                  <Input
                    id="secondaryButtonText"
                    name="secondaryButtonText"
                    defaultValue={heroContent.secondaryButtonText}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryButtonLink">Secondary Button Link</Label>
                  <Input
                    id="secondaryButtonLink"
                    name="secondaryButtonLink"
                    defaultValue={heroContent.secondaryButtonLink}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="isActive" name="isActive" defaultChecked={heroContent.isActive} />
                <Label htmlFor="isActive">Set as active hero</Label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

