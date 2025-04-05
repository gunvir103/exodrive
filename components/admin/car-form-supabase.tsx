"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Trash, Plus, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CarImageUploader } from "@/components/admin/car-image-uploader"
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import type { Car, CarImage, CarSpecification, CarFeature } from "@/lib/types/car"

interface CarFormProps {
  car?: Car
  isEdit?: boolean
}

export function CarFormSupabase({ car, isEdit = false }: CarFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: car?.name || "",
    slug: car?.slug || "",
    description: car?.description || "",
    shortDescription: car?.shortDescription || "",
    category: car?.category || "Supercar",
    available: car?.available ?? true,
    featured: car?.featured ?? false,
    hidden: car?.hidden ?? false,
  })
  const [specifications, setSpecifications] = useState<CarSpecification[]>(car?.specifications || [])
  const [features, setFeatures] = useState<CarFeature[]>(car?.features || [])
  const [images, setImages] = useState<CarImage[]>(car?.images || [])
  const [newFeature, setNewFeature] = useState("")
  const [newSpecName, setNewSpecName] = useState("")
  const [newSpecValue, setNewSpecValue] = useState("")
  const [newSpecHighlighted, setNewSpecHighlighted] = useState(false)
  const [categories, setCategories] = useState<string[]>([])

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const fetchedCategories = await carServiceSupabase.getCategories()
        setCategories(fetchedCategories)
      } catch (error) {
        console.error("Error fetching categories:", error)
        toast({
          title: "Error",
          description: "Failed to load categories",
          variant: "destructive",
        })
      }
    }

    fetchCategories()
  }, [toast])

  // Generate slug from name
  useEffect(() => {
    if (!isEdit && formData.name && !formData.slug) {
      setFormData((prev) => ({
        ...prev,
        slug: formData.name
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-"),
      }))
    }
  }, [formData.name, isEdit, formData.slug])

  // Generate short description from description
  useEffect(() => {
    if (!isEdit && formData.description && !formData.shortDescription) {
      setFormData((prev) => ({
        ...prev,
        shortDescription: formData.description.substring(0, 120) + "...",
      }))
    }
  }, [formData.description, isEdit, formData.shortDescription])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleAddSpecification = () => {
    if (newSpecName.trim() && newSpecValue.trim()) {
      setSpecifications((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          name: newSpecName.trim(),
          value: newSpecValue.trim(),
          isHighlighted: newSpecHighlighted,
        },
      ])
      setNewSpecName("")
      setNewSpecValue("")
      setNewSpecHighlighted(false)
    }
  }

  const handleRemoveSpecification = (id: string) => {
    setSpecifications((prev) => prev.filter((spec) => spec.id !== id))
  }

  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setFeatures((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          name: newFeature.trim(),
          isHighlighted: false,
        },
      ])
      setNewFeature("")
    }
  }

  const handleRemoveFeature = (id: string) => {
    setFeatures((prev) => prev.filter((feature) => feature.id !== id))
  }

  const handleImagesChange = (updatedImages: CarImage[]) => {
    setImages(updatedImages)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // Validate form
      if (!formData.name || !formData.slug || !formData.description || !formData.category) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        })
        setIsSaving(false)
        return
      }

      // Prepare car data
      const carData: Partial<Car> = {
        ...formData,
        specifications,
        features,
        images,
        pricing: car?.pricing || {
          id: `temp-${Date.now()}`,
          basePrice: 0,
          currency: "USD",
          depositAmount: 0,
          minimumDays: 1,
          additionalFees: [],
        },
      }

      if (isEdit && car) {
        // Update existing car
        await carServiceSupabase.updateCar(car.id, carData)
        toast({
          title: "Car updated",
          description: "The car has been updated successfully.",
        })
      } else {
        // Create new car
        await carServiceSupabase.createCar(carData as Omit<Car, "id" | "createdAt" | "updatedAt">)
        toast({
          title: "Car created",
          description: "The car has been added to your fleet.",
        })
      }

      router.push("/admin/cars")
    } catch (error) {
      console.error("Error saving car:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save car",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => router.back()} className="mr-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Car" : "Add New Car"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Car Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Lamborghini Huracán"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  name="slug"
                  placeholder="e.g. lamborghini-huracan"
                  value={formData.slug}
                  onChange={handleInputChange}
                  required
                />
                <p className="text-xs text-muted-foreground">Used in the URL: /fleet/[slug]</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe the car..."
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="shortDescription">Short Description</Label>
                <Textarea
                  id="shortDescription"
                  name="shortDescription"
                  placeholder="Brief description for listings..."
                  rows={2}
                  value={formData.shortDescription}
                  onChange={handleInputChange}
                />
                <p className="text-xs text-muted-foreground">
                  Used in car listings. If left empty, it will be generated from the description.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length > 0 ? (
                      categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="Supercar">Supercar</SelectItem>
                        <SelectItem value="Sports Car">Sports Car</SelectItem>
                        <SelectItem value="Luxury">Luxury</SelectItem>
                        <SelectItem value="Convertible">Convertible</SelectItem>
                        <SelectItem value="SUV">SUV</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent>
            <CarImageUploader carId={car?.id || "new"} initialImages={images} onImagesChange={handleImagesChange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="newSpecName">Specification Name</Label>
                <Input
                  id="newSpecName"
                  placeholder="e.g. Engine"
                  value={newSpecName}
                  onChange={(e) => setNewSpecName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newSpecValue">Value</Label>
                <Input
                  id="newSpecValue"
                  placeholder="e.g. 5.2L V10"
                  value={newSpecValue}
                  onChange={(e) => setNewSpecValue(e.target.value)}
                />
              </div>
              <div className="flex items-end space-x-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="newSpecHighlighted"
                    checked={newSpecHighlighted}
                    onCheckedChange={setNewSpecHighlighted}
                  />
                  <Label htmlFor="newSpecHighlighted">Highlight</Label>
                </div>
                <Button
                  type="button"
                  onClick={handleAddSpecification}
                  disabled={!newSpecName.trim() || !newSpecValue.trim()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h3 className="font-medium">Current Specifications</h3>
              {specifications.length > 0 ? (
                <div className="grid gap-2">
                  {specifications.map((spec) => (
                    <div key={spec.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
                      <div className="flex items-center">
                        {spec.isHighlighted && (
                          <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded mr-2">
                            Highlighted
                          </span>
                        )}
                        <span className="font-medium">{spec.name}:</span>
                        <span className="ml-2">{spec.value}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSpecification(spec.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No specifications added yet. Add some specifications to highlight the car's features.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add a feature..."
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddFeature()
                  }
                }}
              />
              <Button type="button" onClick={handleAddFeature} disabled={!newFeature.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {features.map((feature) => (
                <div key={feature.id} className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                  <span className="flex-1">{feature.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveFeature(feature.id)}
                    className="h-6 w-6"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {features.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No features added yet. Add some features to highlight what makes this car special.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visibility Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="available">Available for Rent</Label>
                <p className="text-sm text-muted-foreground">
                  Indicates if this car is currently available for booking
                </p>
              </div>
              <Switch
                id="available"
                checked={formData.available}
                onCheckedChange={(checked) => handleSwitchChange("available", checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="featured">Featured Car</Label>
                <p className="text-sm text-muted-foreground">Display this car on the homepage as a featured vehicle</p>
              </div>
              <Switch
                id="featured"
                checked={formData.featured}
                onCheckedChange={(checked) => handleSwitchChange("featured", checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="hidden">Hide from Fleet</Label>
                <p className="text-sm text-muted-foreground">Temporarily hide this car from the fleet page</p>
              </div>
              <Switch
                id="hidden"
                checked={formData.hidden}
                onCheckedChange={(checked) => handleSwitchChange("hidden", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </span>
            ) : isEdit ? (
              "Update Car"
            ) : (
              "Add Car"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

