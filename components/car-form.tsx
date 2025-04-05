"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Trash, Upload, Plus, X, Move } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToParentElement } from "@dnd-kit/modifiers"
import { carServiceSupabase } from "@/lib/services/car-service-supabase"
import type { Car as AppCar } from "@/lib/types/car"
import { BUCKET_NAMES } from "@/lib/supabase/storage-service"

// Interface for image data stored in state
interface ImageData {
  url: string;
  path: string;
}

interface CarFormProps {
  car?: AppCar; // Use the updated AppCar type
}

interface SortableImageProps {
  image: ImageData;
  index: number;
  isPrimary: boolean;
  onRemove: (index: number) => void;
}

function SortableImage({ image, index, isPrimary, onRemove }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `image-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group" {...attributes}>
      <div className="relative aspect-video rounded-md overflow-hidden border cursor-move" {...listeners}>
        <Image src={image.url || "/placeholder.svg"} alt={`Car image ${index + 1}`} fill className="object-cover" />
        {isPrimary && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs py-1 px-2 rounded">
            Main Image
          </div>
        )}
      </div>
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
            e.stopPropagation(); // Prevent drag listeners from firing
            onRemove(index);
        }}
        type="button"
      >
        <Trash className="h-4 w-4" />
      </Button>
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        <Move className="h-3 w-3 inline mr-1" />
        Drag to reorder
      </div>
    </div>
  );
}

export function CarForm({ car }: CarFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  // State for image URLs and storage paths
  const [imageData, setImageData] = useState<ImageData[]>([]);
  // State for features
  const [features, setFeatures] = useState<Record<string, any>>(car?.features || {});
  const [newFeatureKey, setNewFeatureKey] = useState("");
  const [newFeatureValue, setNewFeatureValue] = useState("");

  // State for specifications
  const [specifications, setSpecifications] = useState<Record<string, any>>(car?.specifications || {});
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");

  // Effect to initialize imageData from car prop (needs paths, might require fetching)
  useEffect(() => {
    if (car?.imageUrls && car.imageUrls.length > 0) {
      // PROBLEM: We only have URLs from the DB, not storage paths.
      // Need a way to map URLs back to storage paths OR store paths in the DB.
      // For now, we'll make a basic assumption based on common URL structure,
      // but this is NOT ROBUST and should ideally be improved.
      // Assumes URL format: https://<project_ref>.supabase.co/storage/v1/object/public/vehicle-images/<user_id>/<uuid>.<ext>
      // And storagePath format: <user_id>/<uuid>.<ext>
      const initialData = car.imageUrls.map(url => {
        let path = '';
        try {
          const urlParts = new URL(url).pathname.split('/');
          // Find the bucket name index and take everything after it
          const bucketIndex = urlParts.findIndex(part => part === (BUCKET_NAMES.VEHICLE_IMAGES || "vehicle-images"));
          if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
              path = urlParts.slice(bucketIndex + 1).join('/');
          }
        } catch (e) {
          console.error("Failed to parse storage path from URL:", url, e);
        }
         if (!path) {
              console.warn("Could not determine storage path for URL, deletion might fail:", url);
         }
        return { url, path };
      });
      setImageData(initialData);
    } else {
       setImageData([]);
    }
  }, [car]); // Re-run if car data changes

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsLoading(true);
    const uploadedImageData: ImageData[] = []; // Store {url, path} objects

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/cars/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to upload image");
        }

        const result = await response.json();
        // Store both publicUrl and storagePath
        if (result.publicUrl && result.storagePath) {
          uploadedImageData.push({ url: result.publicUrl, path: result.storagePath });
        } else {
            throw new Error("Upload API did not return URL and Path");
        }
      } catch (error: any) {
        console.error("Image upload error:", error);
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: error.message || "Could not upload one or more images.",
        });
      }
    }

    if (uploadedImageData.length > 0) {
      setImageData((prevData) => [...prevData, ...uploadedImageData]); // Update state
    }
    setIsLoading(false);

     event.target.value = "";
  };

  const removeImage = async (indexToRemove: number) => {
    const imageToRemove = imageData[indexToRemove];
    if (!imageToRemove) return;

    if (!imageToRemove.path) {
        toast({
            variant: "default",
            title: "Image Path Unknown",
            description: "Storage path not found for this image. It will be removed from the form but cannot be deleted from storage.",
            duration: 5000,
        });
         setImageData((prevData) => prevData.filter((_, index) => index !== indexToRemove));
        return;
    }

    // Optimistic UI update
    setImageData((prevData) => prevData.filter((_, index) => index !== indexToRemove));

    try {
      const response = await fetch("/api/cars/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the storagePath
        body: JSON.stringify({ storagePath: imageToRemove.path }),
      });

      if (!response.ok) {
         const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
         console.error("Failed to delete image from storage:", errorData);
         toast({
             variant: "destructive",
             title: "Storage Delete Failed",
             description: errorData.error || "Could not remove image from storage."
         });
         // Revert UI update on failure
         setImageData((prevData) => {
           const newData = [...prevData];
           newData.splice(indexToRemove, 0, imageToRemove); // Add back the removed item
           return newData;
         });
      } else {
          toast({ title: "Image Removed", description: "Image successfully removed from storage." });
      }
    } catch (error: any) {
       console.error("Error calling delete image API:", error);
       toast({
           variant: "destructive",
           title: "Error",
           description: "An error occurred while trying to remove the image."
       });
       // Revert UI update on error
       setImageData((prevData) => {
         const newData = [...prevData];
         newData.splice(indexToRemove, 0, imageToRemove); // Add back the removed item
         return newData;
       });
    }
  };

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    setImageData((items) => { // Use setImageData
      const oldIndexStr = String(active.id).split("-")[1];
      const newIndexStr = String(over.id).split("-")[1];
      const oldIndex = Number.parseInt(oldIndexStr);
      const newIndex = Number.parseInt(newIndexStr);

      if (isNaN(oldIndex) || isNaN(newIndex)) return items;

      const newItems = [...items];
      const [removed] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, removed);
      return newItems;
    });
  }, []); // Dependency array is empty as it relies on setImageData setter

  // --- Feature Handlers ---
  const addFeature = () => {
    if (newFeatureKey.trim() && newFeatureValue.trim()) {
      setFeatures({ ...features, [newFeatureKey.trim()]: newFeatureValue.trim() });
      setNewFeatureKey("");
      setNewFeatureValue("");
    }
  };

  const removeFeature = (keyToRemove: string) => {
    const { [keyToRemove]: _, ...remainingFeatures } = features;
    setFeatures(remainingFeatures);
  };

  // --- Specification Handlers ---
  const addSpecification = () => {
    if (newSpecKey.trim() && newSpecValue.trim()) {
      setSpecifications({ ...specifications, [newSpecKey.trim()]: newSpecValue.trim() });
      setNewSpecKey("");
      setNewSpecValue("");
    }
  };

  const removeSpecification = (keyToRemove: string) => {
    const { [keyToRemove]: _, ...remainingSpecs } = specifications;
    setSpecifications(remainingSpecs);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const formValues = Object.fromEntries(formData.entries());

    // Basic numeric conversion (add more robust validation/parsing as needed)
    const pricePerDay = parseFloat(formValues.pricePerDay as string);
    const depositAmount = formValues.depositAmount ? parseFloat(formValues.depositAmount as string) : undefined;
    const year = formValues.year ? parseInt(formValues.year as string, 10) : undefined;
    const horsepower = formValues.horsepower ? parseInt(formValues.horsepower as string, 10) : undefined;
    const acceleration060 = formValues.acceleration060 ? parseFloat(formValues.acceleration060 as string) : undefined;
    const topSpeed = formValues.topSpeed ? parseInt(formValues.topSpeed as string, 10) : undefined;

    const carDataPayload: Omit<AppCar, "id" | "createdAt" | "updatedAt"> = {
      name: formValues.name as string,
      slug: (formValues.name as string).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''), // Basic slug generation
      make: formValues.make as string || undefined,
      model: formValues.model as string || undefined,
      year: isNaN(year!) ? undefined : year,
      category: formValues.category as string,
      description: formValues.description as string || undefined,
      shortDescription: formValues.shortDescription as string || undefined,
      pricePerDay: isNaN(pricePerDay) ? 0 : pricePerDay, // Default or validation needed
      depositAmount: isNaN(depositAmount!) ? undefined : depositAmount,
      engine: formValues.engine as string || undefined,
      horsepower: isNaN(horsepower!) ? undefined : horsepower,
      acceleration060: isNaN(acceleration060!) ? undefined : acceleration060,
      topSpeed: isNaN(topSpeed!) ? undefined : topSpeed,
      transmission: formValues.transmission as string || undefined,
      drivetrain: formValues.drivetrain as string || undefined,
      features: features,
      specifications: specifications,
      // Map imageData back to string[] of URLs for the service/DB
      imageUrls: imageData.map(img => img.url),
      isAvailable: formValues.isAvailable === "on",
      isFeatured: formValues.isFeatured === "on",
      isHidden: formValues.isHidden === "on",
    };

    try {
        let resultCar: AppCar | null = null;
        if (car?.id) {
            resultCar = await carServiceSupabase.updateCar(car.id, carDataPayload);
        } else {
            resultCar = await carServiceSupabase.createCar(carDataPayload);
        }

        toast({
            title: car?.id ? "Car Updated" : "Car Created",
            description: `The car "${resultCar.name}" has been ${car?.id ? 'updated' : 'added'}.`,
        });
        router.push("/admin/cars");
        router.refresh();

    } catch (error: any) {
        console.error("Failed to save car:", error);
        toast({
            variant: "destructive",
            title: "Save Failed",
            description: error.message || "Could not save car data. Please try again.",
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center">
         <Button variant="ghost" onClick={() => router.back()} className="mr-4">
           <ArrowLeft className="mr-2 h-4 w-4" />
           Back
         </Button>
         <h1 className="text-2xl font-bold">{car ? "Edit Car" : "Add New Car"}</h1>
       </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Car Name *</Label>
                <Input id="name" name="name" placeholder="e.g. Lamborghini Huracán" defaultValue={car?.name} required />
              </div>
               <div className="space-y-2">
                 <Label htmlFor="make">Make</Label>
                 <Input id="make" name="make" placeholder="e.g. Lamborghini" defaultValue={car?.make} />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="model">Model</Label>
                 <Input id="model" name="model" placeholder="e.g. Huracán EVO" defaultValue={car?.model} />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="year">Year</Label>
                 <Input id="year" name="year" type="number" placeholder="e.g. 2023" defaultValue={car?.year} />
               </div>
              <div className="space-y-2">
                <Label htmlFor="pricePerDay">Daily Rate ($) *</Label>
                <Input id="pricePerDay" name="pricePerDay" type="number" step="0.01" placeholder="e.g. 1200.00" defaultValue={car?.pricePerDay} required />
              </div>
               <div className="space-y-2">
                 <Label htmlFor="depositAmount">Deposit Amount ($)</Label>
                 <Input id="depositAmount" name="depositAmount" type="number" step="0.01" placeholder="e.g. 5000.00" defaultValue={car?.depositAmount} />
               </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="shortDescription">Short Description</Label>
                <Input id="shortDescription" name="shortDescription" placeholder="Brief tagline for the car list..." defaultValue={car?.shortDescription} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Full Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Detailed description of the car..."
                  rows={4}
                  defaultValue={car?.description}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select name="category" defaultValue={car?.category || "Supercar"} required>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add more relevant categories */}
                    <SelectItem value="Supercar">Supercar</SelectItem>
                    <SelectItem value="Sports Car">Sports Car</SelectItem>
                    <SelectItem value="Luxury Sedan">Luxury Sedan</SelectItem>
                    <SelectItem value="Luxury SUV">Luxury SUV</SelectItem>
                    <SelectItem value="Convertible">Convertible</SelectItem>
                    <SelectItem value="Exotic">Exotic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Specifications</h2>
             <p className="text-sm text-muted-foreground mb-4">Enter key technical details. These might be displayed in a table or list.</p>
            <div className="grid gap-4 sm:grid-cols-2 mb-6">
               {/* Specific common inputs */} 
              <div className="space-y-2">
                <Label htmlFor="engine">Engine</Label>
                <Input id="engine" name="engine" placeholder="e.g. 5.2L V10" defaultValue={car?.engine} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horsepower">Horsepower (hp)</Label>
                <Input id="horsepower" name="horsepower" type="number" placeholder="e.g. 610" defaultValue={car?.horsepower} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acceleration060">0-60 mph (seconds)</Label>
                <Input id="acceleration060" name="acceleration060" type="number" step="0.1" placeholder="e.g. 2.9" defaultValue={car?.acceleration060} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topSpeed">Top Speed (mph)</Label>
                <Input id="topSpeed" name="topSpeed" type="number" placeholder="e.g. 201" defaultValue={car?.topSpeed} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transmission">Transmission</Label>
                <Input
                  id="transmission"
                  name="transmission"
                  placeholder="e.g. 7-speed dual-clutch"
                  defaultValue={car?.transmission}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drivetrain">Drivetrain</Label>
                <Input id="drivetrain" name="drivetrain" placeholder="e.g. All-wheel drive" defaultValue={car?.drivetrain} />
              </div>
            </div>

            <Separator className="my-6" />

            <h3 className="text-lg font-medium mb-3">Additional Specifications</h3>
             {/* Dynamic Key-Value Specs */}
             <div className="space-y-3 mb-4">
               {Object.entries(specifications).map(([key, value]) => (
                 <motion.div
                   key={key}
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: "auto" }}
                   exit={{ opacity: 0, height: 0 }}
                   className="flex items-center gap-2"
                 >
                   <Input value={key} disabled className="font-medium" />
                   <Input value={value as string} disabled />
                   <Button
                     type="button"
                     variant="ghost"
                     size="icon"
                     onClick={() => removeSpecification(key)}
                     className="text-muted-foreground hover:text-destructive"
                   >
                     <X className="h-4 w-4" />
                   </Button>
                 </motion.div>
               ))}
             </div>

             <div className="flex items-end gap-2">
               <div className="flex-1 space-y-1">
                 <Label htmlFor="new-spec-key" className="text-xs">Spec Name</Label>
                 <Input
                   id="new-spec-key"
                   placeholder="e.g. Color"
                   value={newSpecKey}
                   onChange={(e) => setNewSpecKey(e.target.value)}
                 />
               </div>
                <div className="flex-1 space-y-1">
                 <Label htmlFor="new-spec-value" className="text-xs">Spec Value</Label>
                 <Input
                    id="new-spec-value"
                   placeholder="e.g. Rosso Mars"
                   value={newSpecValue}
                   onChange={(e) => setNewSpecValue(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === "Enter") {
                       e.preventDefault();
                       addSpecification();
                     }
                   }}
                 />
               </div>
               <Button type="button" onClick={addSpecification} variant="outline" size="icon">
                 <Plus className="h-4 w-4" />
               </Button>
             </div>

          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Features</h2>
             <p className="text-sm text-muted-foreground mb-4">Highlight key features or amenities (e.g., Navigation, Bluetooth, Sunroof).</p>
             {/* Dynamic Key-Value Features */}
             <div className="space-y-3 mb-4">
                {Object.entries(features).map(([key, value]) => (
                 <motion.div
                   key={key}
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: "auto" }}
                   exit={{ opacity: 0, height: 0 }}
                   className="flex items-center gap-2"
                 >
                    {/* Displaying Features - adjust how value (e.g., boolean) is shown */}
                   <Input value={key} disabled className="font-medium" />
                   <Input value={String(value)} disabled />
                   <Button
                     type="button"
                     variant="ghost"
                     size="icon"
                     onClick={() => removeFeature(key)}
                     className="text-muted-foreground hover:text-destructive"
                   >
                     <X className="h-4 w-4" />
                   </Button>
                 </motion.div>
               ))}
              </div>

             <div className="flex items-end gap-2">
               <div className="flex-1 space-y-1">
                 <Label htmlFor="new-feature-key" className="text-xs">Feature Name</Label>
                 <Input
                   id="new-feature-key"
                   placeholder="e.g. Apple CarPlay"
                   value={newFeatureKey}
                   onChange={(e) => setNewFeatureKey(e.target.value)}
                 />
               </div>
               <div className="flex-1 space-y-1">
                 <Label htmlFor="new-feature-value" className="text-xs">Value (optional)</Label>
                 <Input
                    id="new-feature-value"
                   placeholder="e.g. true, Standard" 
                   value={newFeatureValue}
                   onChange={(e) => setNewFeatureValue(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === "Enter") {
                       e.preventDefault();
                       addFeature();
                     }
                   }}
                 />
               </div>
               <Button type="button" onClick={addFeature} variant="outline" size="icon">
                 <Plus className="h-4 w-4" />
               </Button>
             </div>

          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Images</h2>
            <div className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToParentElement]}
                  >
                    <SortableContext items={imageData.map((_, i) => `image-${i}`)} strategy={verticalListSortingStrategy}>
                      {imageData.map((imgData, index) => (
                        <SortableImage key={`${imgData.path || imgData.url}-${index}`} image={imgData} index={index} isPrimary={index === 0} onRemove={removeImage} />
                      ))}
                    </SortableContext>
                  </DndContext>
                  {/* File Input for Upload */}
                  <div>
                       <Label
                           htmlFor="image-upload"
                           className="cursor-pointer h-auto aspect-video flex flex-col items-center justify-center border-2 border-dashed rounded-md hover:border-primary hover:bg-accent transition-colors"
                       >
                           <Upload className="h-8 w-8 mb-2" />
                           <span>Upload Images</span>
                           <span className="text-xs text-muted-foreground mt-1">Click or drag files</span>
                       </Label>
                       <Input
                           id="image-upload"
                           type="file"
                           multiple
                           accept="image/*"
                           onChange={handleImageUpload}
                           className="sr-only" // Hide the default input
                           disabled={isLoading}
                       />
                   </div>
               </div>

              <p className="text-sm text-muted-foreground">
                Upload high-quality images. The first image is the main image. Drag to reorder.
              </p>

              {imageData.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No images uploaded yet</p>
                  {/* Trigger hidden file input on button click */}
                   <Button variant="outline" onClick={() => document.getElementById('image-upload')?.click()} type="button" className="mt-4">
                       Upload First Image
                   </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Visibility Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isAvailable">Available for Rent</Label>
                  <p className="text-sm text-muted-foreground">
                    Is this car currently available for customers to book?
                  </p>
                </div>
                <Switch id="isAvailable" name="isAvailable" defaultChecked={car?.isAvailable ?? true} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isFeatured">Featured Car</Label>
                  <p className="text-sm text-muted-foreground">
                    Display this car prominently (e.g., on the homepage)?
                  </p>
                </div>
                <Switch id="isFeatured" name="isFeatured" defaultChecked={car?.isFeatured} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isHidden">Hide from Fleet (Admin)</Label>
                  <p className="text-sm text-muted-foreground">Temporarily hide this car from public view (still accessible in admin)?</p>
                </div>
                <Switch id="isHidden" name="isHidden" defaultChecked={car?.isHidden} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
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
            ) : car?.id ? (
              "Update Car"
            ) : (
              "Add Car"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

