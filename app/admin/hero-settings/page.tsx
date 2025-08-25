"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { heroContents, type HeroContent } from "@/lib/hero-content"
import { ArrowLeft, Plus, Trash, Upload, Eye, Save, Check } from "lucide-react"

export default function HeroSettingsPage() {
  const [heroes, setHeroes] = useState<HeroContent[]>([])
  const [activeTab, setActiveTab] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Load hero contents
  useEffect(() => {
    setHeroes(heroContents)
    if (heroContents.length > 0) {
      setActiveTab(heroContents[0].id)
    }
  }, [])

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>, heroId: string) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const updatedHero: Partial<HeroContent> = {
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

    // Update the hero in the state
    const updatedHeroes = heroes.map((hero) => {
      if (hero.id === heroId) {
        return { ...hero, ...updatedHero }
      }

      // If this hero is set to active, set others to inactive
      if (updatedHero.isActive && hero.id !== heroId) {
        return { ...hero, isActive: false }
      }

      return hero
    })

    // Update the state
    setHeroes(updatedHeroes)

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Hero updated",
        description: "The hero section has been updated successfully.",
      })
    }, 1000)
  }

  // Handle adding a new hero
  const handleAddHero = () => {
    const newHero: HeroContent = {
      id: `hero-${Date.now()}`,
      title: "New *Hero* Title",
      subtitle: "Add your subtitle here",
      backgroundType: "image",
      backgroundSrc: "/placeholder.svg?height=1080&width=1920&text=New+Hero",
      badgeText: "New Badge",
      primaryButtonText: "Primary Button",
      primaryButtonLink: "/",
      secondaryButtonText: "Secondary Button",
      secondaryButtonLink: "/",
      isActive: false,
    }

    setHeroes([...heroes, newHero])
    setActiveTab(newHero.id)
  }

  // Handle deleting a hero
  const handleDeleteHero = (heroId: string) => {
    // Don't delete if it's the only hero
    if (heroes.length <= 1) {
      toast({
        title: "Cannot delete",
        description: "You must have at least one hero section.",
        variant: "destructive",
      })
      return
    }

    // Find the hero to delete
    const heroToDelete = heroes.find((hero) => hero.id === heroId)

    // If deleting the active hero, make sure another one is set to active
    if (heroToDelete?.isActive) {
      const otherHero = heroes.find((hero) => hero.id !== heroId)
      if (otherHero) {
        otherHero.isActive = true
      }
    }

    // Remove the hero
    const updatedHeroes = heroes.filter((hero) => hero.id !== heroId)
    setHeroes(updatedHeroes)

    // Set the active tab to another hero
    if (updatedHeroes.length > 0) {
      setActiveTab(updatedHeroes[0].id)
    }

    toast({
      title: "Hero deleted",
      description: "The hero section has been deleted.",
    })
  }

  // Handle image upload (simulated)
  const handleImageUpload = (heroId: string) => {
    // In a real app, this would open a file picker and upload to storage
    const updatedHeroes = heroes.map((hero) => {
      if (hero.id === heroId) {
        return {
          ...hero,
          backgroundSrc: `/placeholder.svg?height=1080&width=1920&text=Uploaded+${Date.now()}`,
        }
      }
      return hero
    })

    setHeroes(updatedHeroes)

    toast({
      title: "Image uploaded",
      description: "The background image has been updated.",
    })
  }

  // Preview the hero section
  const handlePreview = () => {
    setPreviewMode(!previewMode)
  }

  // Render the hero preview
  const renderHeroPreview = (hero: HeroContent) => {
    return (
      <div className="relative h-[400px] rounded-lg overflow-hidden">
        {hero.backgroundType === "image" ? (
          <Image src={hero.backgroundSrc || "/placeholder.svg"} alt="Hero preview" fill className="object-cover" />
        ) : (
          <video autoPlay muted loop playsInline className="object-cover w-full h-full">
            <source src={hero.backgroundSrc} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="inline-block px-2 py-1 mb-2 text-xs font-medium rounded bg-secondary/20 text-secondary-foreground border border-secondary/30">
            {hero.badgeText}
          </div>
          <h3 className="text-xl font-bold mb-2">{hero.title.replace(/\*/g, "")}</h3>
          <p className="mb-4 text-sm text-gray-200">{hero.subtitle}</p>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-primary/80 text-primary-foreground text-xs rounded">
              {hero.primaryButtonText}
            </div>
            <div className="px-3 py-1 bg-secondary/80 text-secondary-foreground text-xs rounded">
              {hero.secondaryButtonText}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => router.back()} className="mr-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Hero Section Settings</h1>
        </div>
        <Button onClick={handleAddHero}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Hero
        </Button>
      </div>

      {heroes.length > 0 ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              {heroes.map((hero) => (
                <TabsTrigger key={hero.id} value={hero.id} className="relative">
                  {hero.title.replace(/\*/g, "").substring(0, 15)}...
                  {hero.isActive && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button variant="outline" onClick={handlePreview}>
              {previewMode ? (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Edit Mode
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
          </div>

          {heroes.map((hero) => (
            <TabsContent key={hero.id} value={hero.id}>
              {previewMode ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Hero Preview</CardTitle>
                    <CardDescription>This is how your hero section will look on the website</CardDescription>
                  </CardHeader>
                  <CardContent>{renderHeroPreview(hero)}</CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => setPreviewMode(false)}>
                      Back to Edit
                    </Button>
                    {hero.isActive ? (
                      <Button variant="default" disabled className="bg-green-600 hover:bg-green-700">
                        <Check className="mr-2 h-4 w-4" />
                        Active
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        onClick={() => {
                          const updatedHeroes = heroes.map((h) => ({
                            ...h,
                            isActive: h.id === hero.id,
                          }))
                          setHeroes(updatedHeroes)
                          toast({
                            title: "Hero activated",
                            description: "This hero is now active on the website.",
                          })
                        }}
                      >
                        Set as Active
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Edit Hero</CardTitle>
                    <CardDescription>Customize the hero section that appears on the homepage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form id={`hero-form-${hero.id}`} onSubmit={(e) => handleSubmit(e, hero.id)}>
                      <div className="grid gap-6">
                        <div className="grid gap-3">
                          <Label htmlFor="title">Title</Label>
                          <Input
                            id="title"
                            name="title"
                            defaultValue={hero.title}
                            placeholder="Drive Your *Dream Car* Today"
                          />
                          <p className="text-xs text-muted-foreground">
                            Use * around words to highlight them with a gradient (e.g., *Dream Car*)
                          </p>
                        </div>

                        <div className="grid gap-3">
                          <Label htmlFor="subtitle">Subtitle</Label>
                          <Textarea
                            id="subtitle"
                            name="subtitle"
                            defaultValue={hero.subtitle}
                            placeholder="Experience the thrill of driving the world's most exotic cars..."
                            rows={3}
                          />
                        </div>

                        <div className="grid gap-3">
                          <Label>Background Type</Label>
                          <RadioGroup
                            defaultValue={hero.backgroundType}
                            name="backgroundType"
                            className="flex space-x-4"
                          >
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

                        <div className="grid gap-3">
                          <Label htmlFor="backgroundSrc">Background Source</Label>
                          <div className="flex gap-2">
                            <Input
                              id="backgroundSrc"
                              name="backgroundSrc"
                              defaultValue={hero.backgroundSrc}
                              placeholder="/images/hero-background.jpg"
                              className="flex-1"
                            />
                            <Button type="button" variant="outline" onClick={() => handleImageUpload(hero.id)}>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload
                            </Button>
                          </div>
                          <div className="relative h-40 bg-muted rounded-md overflow-hidden">
                            {hero.backgroundType === "image" ? (
                              <Image
                                src={hero.backgroundSrc || "/placeholder.svg"}
                                alt="Background preview"
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <p className="text-muted-foreground">Video preview not available</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator />

                        <div className="grid gap-3">
                          <Label htmlFor="badgeText">Badge Text</Label>
                          <Input
                            id="badgeText"
                            name="badgeText"
                            defaultValue={hero.badgeText}
                            placeholder="Premium Experience"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="grid gap-3">
                            <Label htmlFor="primaryButtonText">Primary Button Text</Label>
                            <Input
                              id="primaryButtonText"
                              name="primaryButtonText"
                              defaultValue={hero.primaryButtonText}
                              placeholder="Browse Our Fleet"
                            />
                          </div>
                          <div className="grid gap-3">
                            <Label htmlFor="primaryButtonLink">Primary Button Link</Label>
                            <Input
                              id="primaryButtonLink"
                              name="primaryButtonLink"
                              defaultValue={hero.primaryButtonLink}
                              placeholder="/fleet"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="grid gap-3">
                            <Label htmlFor="secondaryButtonText">Secondary Button Text</Label>
                            <Input
                              id="secondaryButtonText"
                              name="secondaryButtonText"
                              defaultValue={hero.secondaryButtonText}
                              placeholder="Rent Now"
                            />
                          </div>
                          <div className="grid gap-3">
                            <Label htmlFor="secondaryButtonLink">Secondary Button Link</Label>
                            <Input
                              id="secondaryButtonLink"
                              name="secondaryButtonLink"
                              defaultValue={hero.secondaryButtonLink}
                              placeholder="https://instagram.com/..."
                            />
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch id="isActive" name="isActive" defaultChecked={hero.isActive} />
                          <Label htmlFor="isActive">Set as active hero</Label>
                        </div>
                      </div>
                    </form>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteHero(hero.id)}
                      disabled={heroes.length <= 1}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                    <Button type="submit" form={`hero-form-${hero.id}`} disabled={isLoading}>
                      {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium mb-2">No Hero Sections</h3>
            <p className="text-muted-foreground text-center mb-4">
              You haven't created any hero sections yet. Add one to get started.
            </p>
            <Button onClick={handleAddHero}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Hero
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

