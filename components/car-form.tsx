"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase/client" // Correct import
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Trash, Upload, Plus, X, Move, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove // Import arrayMove for reordering
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToParentElement } from "@dnd-kit/modifiers"
import { carServiceSupabase, type AppCar, type CarImage, type CarFeature, type CarSpecification, type AppCarUpsert, type PricingInsertData, type ImageInsertData, type FeatureInsertData, type SpecificationInsertData } from "@/lib/services/car-service-supabase"
import { BUCKET_NAMES } from "@/lib/supabase/storage-service"
import { v4 as uuidv4 } from 'uuid'; // For generating unique file names

// Define a state type for images within the form
interface FormImageData extends Partial<CarImage> {
  id?: string; // Keep existing ID if it's an existing image
  file?: File; // Track the file object for new uploads
  url: string; // Public URL (Supabase or local preview)
  path?: string | null; // Storage path
  isUploading?: boolean;
  uploadError?: string | null;
  sort_order: number; // Ensure sort_order is always present
  is_primary: boolean; // Ensure is_primary is always present
}

interface CarFormProps {
  car?: AppCar; // Use the composite AppCar type
}

interface SortableImageProps {
  image: FormImageData;
  index: number;
  onRemove: (index: number) => void;
}

function SortableImage({ image, index, onRemove }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id || `new-${index}`, // Use DB id or temporary id
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    zIndex: isDragging ? 10 : undefined, // Bring dragging item to front
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group border rounded-md overflow-hidden aspect-video" {...attributes}>
      {/* Drag Handle */}
       <div
            className="absolute top-2 left-2 p-1 bg-background/70 backdrop-blur-sm rounded cursor-move touch-none z-10 opacity-0 group-hover:opacity-100 transition-opacity"
            {...listeners} // Attach drag listeners here
        >
            <Move className="h-4 w-4 text-muted-foreground" />
        </div>
      {/* Image Preview */}
      <Image
        src={image.url || "/placeholder.svg"} // Use image.url which could be Supabase URL or local blob URL
        alt={image.alt || `Car image ${index + 1}`}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Provide sizes for optimization
      />
      {/* Primary Badge */}
      {image.is_primary && (
        <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-medium py-1 px-2 rounded">
          Main
        </div>
      )}
       {/* Loading/Error Indicator */}
       {image.isUploading && (
         <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
           <Loader2 className="h-6 w-6 text-white animate-spin" />
         </div>
       )}
       {image.uploadError && (
          <div className="absolute inset-0 bg-destructive/80 flex flex-col items-center justify-center text-center p-2">
            <X className="h-6 w-6 text-destructive-foreground mb-1" />
            <p className="text-xs text-destructive-foreground font-medium">Upload Failed</p>
             <p className="text-xs text-destructive-foreground/80 line-clamp-2">{image.uploadError}</p>
         </div>
       )}
      {/* Remove Button */}
      <Button
        variant="destructive"
        size="icon"
        className="absolute bottom-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => {
            e.stopPropagation(); // Prevent drag listeners
            onRemove(index);
        }}
        type="button"
        disabled={image.isUploading} // Disable remove during upload
      >
        <Trash className="h-4 w-4" />
      </Button>
    </div>
  );
}


export function CarForm({ car }: CarFormProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient(); // Correct function call
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false); // Loading state for form submission
  const [formImages, setFormImages] = useState<FormImageData[]>([]);

  // State for simple fields that map directly to `cars` table
  const [name, setName] = useState(car?.name || "");
  const [category, setCategory] = useState(car?.category || "Supercar");
  const [description, setDescription] = useState(car?.description || "");
  const [shortDescription, setShortDescription] = useState(car?.short_description || "");
  const [isAvailable, setIsAvailable] = useState(car?.available ?? true);
  const [isFeatured, setIsFeatured] = useState(car?.featured ?? false);
  const [isHidden, setIsHidden] = useState(car?.hidden ?? false);

  // State for pricing fields (from `car_pricing` table)
  const [pricePerDay, setPricePerDay] = useState<string>(car?.pricing?.base_price?.toString() || "");
  const [depositAmount, setDepositAmount] = useState<string>(car?.pricing?.deposit_amount?.toString() || "");
  const [minDays, setMinDays] = useState<string>(car?.pricing?.minimum_days?.toString() || "1");
  const [currency, setCurrency] = useState<string>(car?.pricing?.currency || "USD");

  // State for dynamic key-value pairs (Features & Specifications)
  const [features, setFeatures] = useState<FeatureInsertData[]>(car?.features?.map(f => ({ name: f.name, description: f.description, is_highlighted: f.is_highlighted })) || []);
  const [newFeatureKey, setNewFeatureKey] = useState("");
  const [newFeatureValue, setNewFeatureValue] = useState(""); // Represents 'description' in CarFeature

  const [specifications, setSpecifications] = useState<SpecificationInsertData[]>(car?.specifications?.map(s => ({ name: s.name, value: s.value, is_highlighted: s.is_highlighted })) || []);
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");

  // --- Derived State for common specs (extracted from `specifications` state) ---
  // These allow using standard inputs while storing data in the normalized specs table
  const getSpecValue = (key: string): string => specifications.find(s => s.name.toLowerCase() === key.toLowerCase())?.value || "";
  const setSpecValue = (key: string, value: string) => {
      const keyLower = key.toLowerCase();
      setSpecifications(prev => {
          const existingIndex = prev.findIndex(s => s.name.toLowerCase() === keyLower);
          if (existingIndex > -1) {
              // Update existing
              const updatedSpecs = [...prev];
              updatedSpecs[existingIndex] = { ...updatedSpecs[existingIndex], value: value };
              return updatedSpecs.filter(s => s.value || s.name === key); // Keep if value exists or it's the one being updated
          } else if (value) {
              // Add new if value is provided
              return [...prev, { name: key, value: value, is_highlighted: false }];
          }
          // Remove if value is empty and it wasn't found
          return prev.filter(s => s.name.toLowerCase() !== keyLower);
      });
  };

  const make = getSpecValue("Make");
  const setMake = (value: string) => setSpecValue("Make", value);
  const model = getSpecValue("Model");
  const setModel = (value: string) => setSpecValue("Model", value);
  const year = getSpecValue("Year");
  const setYear = (value: string) => setSpecValue("Year", value);
  const engine = getSpecValue("Engine");
  const setEngine = (value: string) => setSpecValue("Engine", value);
  const horsepower = getSpecValue("Horsepower");
  const setHorsepower = (value: string) => setSpecValue("Horsepower", value);
  const acceleration060 = getSpecValue("0-60 mph");
  const setAcceleration060 = (value: string) => setSpecValue("0-60 mph", value);
  const topSpeed = getSpecValue("Top Speed");
  const setTopSpeed = (value: string) => setSpecValue("Top Speed", value);
  const transmission = getSpecValue("Transmission");
  const setTransmission = (value: string) => setSpecValue("Transmission", value);
  const drivetrain = getSpecValue("Drivetrain");
  const setDrivetrain = (value: string) => setSpecValue("Drivetrain", value);

  // --- Initialize Image State ---
  useEffect(() => {
    if (car?.images && car.images.length > 0) {
       // Map DB images to form state, ensuring sort_order and is_primary
       const initialImages = car.images
         .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) // Ensure sorted initially
         .map((img, index) => ({
           ...img,
           file: undefined, // Not a new file
           url: img.url, // DB URL
           isUploading: false,
           uploadError: null,
           sort_order: img.sort_order ?? index, // Use DB sort_order or index fallback
           is_primary: img.is_primary ?? (index === 0) // Use DB primary or fallback to first image
         }));
       setFormImages(initialImages);
     } else {
        setFormImages([]);
     }
  }, [car]); // Re-run if car data changes


  // --- DND Setup ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- Image Handlers ---
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !supabase) return;
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const currentImageCount = formImages.length;
    const newImagesData: FormImageData[] = files.map((file, index) => ({
      id: `new-upload-${Date.now()}-${index}`, // Temporary ID for DND
      file: file,
      url: URL.createObjectURL(file), // Local preview URL
      path: null, // Path assigned after successful upload
      isUploading: true,
      uploadError: null,
      sort_order: currentImageCount + index,
      is_primary: currentImageCount + index === 0, // First image uploaded is primary initially
      alt: file.name // Default alt text
    }));

    // Optimistically add images to state for immediate feedback
    setFormImages((prev) => {
      const updated = [...prev, ...newImagesData];
      // Ensure only one primary image exists after adding
      return updated.map((img, idx) => ({ ...img, is_primary: idx === 0 }));
    });


    // Reset file input
    event.target.value = "";

    // Upload each file
    for (let i = 0; i < newImagesData.length; i++) {
      const imageData = newImagesData[i];
      if (!imageData.file) continue;

      const file = imageData.file;
      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${uuidv4()}.${fileExt}`;
      // User ID could be added to path for RLS: e.g., `${userId}/${uniqueFileName}`
      const filePath = uniqueFileName; // Simplified path for now

      try {
          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
              .from(BUCKET_NAMES.VEHICLE_IMAGES) // Use constant for bucket name
              .upload(filePath, file, {
                  cacheControl: '3600', // Optional: cache control
                  upsert: false, // Don't upsert by default
                  contentType: file.type // Set content type
              });

          if (uploadError) {
              throw uploadError;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
              .from(BUCKET_NAMES.VEHICLE_IMAGES)
              .getPublicUrl(filePath);

          if (!urlData?.publicUrl) {
               throw new Error("Could not get public URL after upload.");
          }

          // Update the specific image state on success
          setFormImages((prev) => prev.map(img =>
              img.id === imageData.id
                  ? { ...img, isUploading: false, url: urlData.publicUrl, path: filePath, uploadError: null }
                  : img
          ));

      } catch (error: any) {
          console.error("Supabase upload error:", error);
          // Update the specific image state on failure
          setFormImages((prev) => prev.map(img =>
              img.id === imageData.id
                  ? { ...img, isUploading: false, uploadError: error.message || "Upload failed" }
                  : img
          ));
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: `Could not upload image "${file.name}": ${error.message}`,
          });
      }
    }
  };

  const removeImage = (indexToRemove: number) => {
    const imageToRemove = formImages[indexToRemove];
    if (!imageToRemove) return;

    // Remove from state immediately (optimistic update)
    setFormImages((prevData) => {
       const newData = prevData.filter((_, index) => index !== indexToRemove);
       // Re-assign primary status and sort order
       return newData.map((img, idx) => ({
         ...img,
         sort_order: idx,
         is_primary: idx === 0
       }));
    });

    // If it was an uploaded image (has a path), attempt to delete from storage
    // No need to delete from DB yet as it hasn't been saved
    if (imageToRemove.path && supabase) {
        supabase.storage
            .from(BUCKET_NAMES.VEHICLE_IMAGES)
            .remove([imageToRemove.path])
            .then(({ data, error }: { data: any | null, error: Error | null }) => { // Add explicit types
                if (error) {
                    console.error("Failed to delete image from storage:", imageToRemove.path, error);
                    toast({
                        variant: "destructive",
                        title: "Storage Delete Failed",
                        description: `Could not remove image ${imageToRemove.path} from storage. It might need manual removal.`,
                    });
                    // Optionally revert UI or notify user more strongly
                } else {
                     toast({ title: "Image Removed", description: `"${imageToRemove.alt || imageToRemove.path}" removed successfully.` });
                }
            });
    }
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return; // No movement or invalid drop target

     setFormImages((items) => {
         const oldIndex = items.findIndex(item => (item.id || `new-${items.indexOf(item)}`) === active.id);
         const newIndex = items.findIndex(item => (item.id || `new-${items.indexOf(item)}`) === over.id);

         if (oldIndex === -1 || newIndex === -1) return items; // Should not happen if IDs are correct

         const reorderedItems = arrayMove(items, oldIndex, newIndex);

         // Re-assign sort_order and is_primary based on the new order
         return reorderedItems.map((item, index) => ({
             ...item,
             sort_order: index,
             is_primary: index === 0,
         }));
     });
  }, []); // No external dependencies needed for arrayMove logic

  // --- Feature Handlers ---
  const addFeature = () => {
    if (newFeatureKey.trim()) { // Only key is needed, value is description
      setFeatures(prev => [...prev, {
          name: newFeatureKey.trim(),
          description: newFeatureValue.trim() || null, // Store value as description
          is_highlighted: false // Default
      }]);
      setNewFeatureKey("");
      setNewFeatureValue("");
    }
  };

  const removeFeature = (nameToRemove: string) => {
    setFeatures(prev => prev.filter(f => f.name !== nameToRemove));
  };

  // --- Specification Handlers ---
  const addSpecification = () => {
    if (newSpecKey.trim() && newSpecValue.trim()) {
      setSpecifications(prev => [...prev, {
          name: newSpecKey.trim(),
          value: newSpecValue.trim(),
          is_highlighted: false // Default
      }]);
      setNewSpecKey("");
      setNewSpecValue("");
    }
  };

  const removeSpecification = (nameToRemove: string) => {
    // Prevent removing core specs managed by dedicated inputs
    const coreSpecs = ["make", "model", "year", "engine", "horsepower", "0-60 mph", "top speed", "transmission", "drivetrain"];
    if (coreSpecs.includes(nameToRemove.toLowerCase())) return;
    setSpecifications(prev => prev.filter(s => s.name !== nameToRemove));
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) {
        toast({ variant: "destructive", title: "Error", description: "Supabase client not available." });
        return;
    }
    // Check for ongoing uploads
    if (formImages.some(img => img.isUploading)) {
        toast({ variant: "destructive", title: "Upload in Progress", description: "Please wait for all images to finish uploading." });
        return;
    }
    // Check for upload errors
    if (formImages.some(img => img.uploadError)) {
        toast({ variant: "destructive", title: "Upload Errors", description: "Some images failed to upload. Please remove them or try again." });
        return;
    }

    setIsLoading(true);

    // --- Prepare Payload ---
    const finalSpecifications = [...specifications]; // Start with current custom specs
    // Add/update core specs from state into the specifications array
    const updateOrAddSpec = (name: string, value: string) => {
        if (!value) return; // Don't add empty specs
        const existingIndex = finalSpecifications.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
        const specData: SpecificationInsertData = { name, value, is_highlighted: false }; // Add is_highlighted default
        if (existingIndex > -1) {
            finalSpecifications[existingIndex] = specData;
        } else {
            finalSpecifications.push(specData);
        }
    };
    updateOrAddSpec("Make", make);
    updateOrAddSpec("Model", model);
    updateOrAddSpec("Year", year);
    updateOrAddSpec("Engine", engine);
    updateOrAddSpec("Horsepower", horsepower);
    updateOrAddSpec("0-60 mph", acceleration060);
    updateOrAddSpec("Top Speed", topSpeed);
    updateOrAddSpec("Transmission", transmission);
    updateOrAddSpec("Drivetrain", drivetrain);


    // Prepare Pricing Data
     const pricingPayload: PricingInsertData = {
      base_price: parseFloat(pricePerDay) || 0,
      deposit_amount: parseFloat(depositAmount) || 0,
      minimum_days: parseInt(minDays, 10) || 1,
      currency: currency || "USD",
      // Add other pricing fields if they exist in the form
      discount_percentage: null, // Example: Set to null if not used
      special_offer_text: null, // Example: Set to null if not used
    };

    // Prepare Image Data (from successfully uploaded images)
    const imagePayload: ImageInsertData[] = formImages
        .filter(img => !img.isUploading && !img.uploadError && img.path) // Only include successfully uploaded with path
        .map(img => ({
            url: img.url, // Final Supabase URL
            path: img.path!,
            alt: img.alt || "Car image", // Use alt directly, name might not exist
            is_primary: img.is_primary,
            sort_order: img.sort_order
        }));

    // Prepare Feature Data
    const featurePayload: FeatureInsertData[] = features;

    const carDataPayload: AppCarUpsert = {
      name: name.trim(),
      // slug is generated server-side now
      category: category,
      description: description.trim() || null,
      short_description: shortDescription.trim() || null,
      available: isAvailable,
      featured: isFeatured,
      hidden: isHidden,
      // Related data
      pricing: pricingPayload,
      images: imagePayload,
      features: featurePayload,
      specifications: finalSpecifications,
    };

    try {
        let resultCar: AppCar | null = null;
        if (car?.id) {
            // Update: Pass Supabase client from hook
            resultCar = await carServiceSupabase.updateCar(supabase, car.id, carDataPayload);
        } else {
            // Create: Pass Supabase client from hook
            // Optionally get and pass userId if needed for created_by
            // const { data: { user } } = await supabase.auth.getUser();
            // resultCar = await carServiceSupabase.createCar(supabase, carDataPayload, user?.id);
             resultCar = await carServiceSupabase.createCar(supabase, carDataPayload); // Simpler version without user ID for now
        }

        toast({
            title: car?.id ? "Car Updated" : "Car Created",
            description: `The car "${resultCar?.name || carDataPayload.name}" has been saved.`, // Use resultCar?.name
        });
        router.push("/admin/cars"); // Redirect to the car list
        router.refresh(); // Refresh server components

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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center">
         <Button variant="ghost" onClick={() => router.back()} className="mr-4">
           <ArrowLeft className="mr-2 h-4 w-4" />
           Back
         </Button>
         <h1 className="text-2xl font-bold">{car ? "Edit Car" : "Add New Car"}</h1>
       </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Name */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Car Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lamborghini Huracán EVO" required />
              </div>
              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                 <Select name="category" value={category} onValueChange={setCategory} required>
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
               {/* Short Description */}
               <div className="space-y-2 sm:col-span-2">
                 <Label htmlFor="shortDescription">Short Description</Label>
                 <Input id="shortDescription" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="Brief tagline for the car list..." />
               </div>
               {/* Full Description */}
               <div className="space-y-2 sm:col-span-2">
                 <Label htmlFor="description">Full Description</Label>
                 <Textarea
                   id="description"
                   value={description}
                   onChange={(e) => setDescription(e.target.value)}
                   placeholder="Detailed description of the car..."
                   rows={4}
                 />
               </div>
            </div>
          </CardContent>
        </Card>

         {/* Pricing Card */}
         <Card>
           <CardContent className="p-6">
             <h2 className="text-xl font-semibold mb-4">Pricing</h2>
             <div className="grid gap-4 sm:grid-cols-2">
               {/* Price Per Day */}
               <div className="space-y-2">
                 <Label htmlFor="pricePerDay">Daily Rate ($) *</Label>
                 <Input id="pricePerDay" value={pricePerDay} onChange={(e) => setPricePerDay(e.target.value)} type="number" step="0.01" placeholder="e.g. 1200.00" required />
               </div>
               {/* Deposit Amount */}
               <div className="space-y-2">
                 <Label htmlFor="depositAmount">Deposit Amount ($)</Label>
                 <Input id="depositAmount" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} type="number" step="0.01" placeholder="e.g. 5000.00" />
               </div>
                 {/* Min Days */}
               <div className="space-y-2">
                 <Label htmlFor="minDays">Minimum Rental Days</Label>
                 <Input id="minDays" value={minDays} onChange={(e) => setMinDays(e.target.value)} type="number" step="1" placeholder="e.g. 1" />
               </div>
               {/* Currency */}
               <div className="space-y-2">
                 <Label htmlFor="currency">Currency</Label>
                  <Select name="currency" value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      {/* Add other currencies if needed */}
                      {/* <SelectItem value="EUR">EUR (€)</SelectItem> */}
                      {/* <SelectItem value="GBP">GBP (£)</SelectItem> */}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
         </Card>

        {/* Specifications Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Specifications</h2>
             <p className="text-sm text-muted-foreground mb-4">Enter key technical details. Use the inputs below for common specs, or add custom ones.</p>
             {/* Common Spec Inputs */}
            <div className="grid gap-4 sm:grid-cols-2 mb-6">
               <div className="space-y-2">
                 <Label htmlFor="make">Make</Label>
                 <Input id="make" value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g. Lamborghini" />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="model">Model</Label>
                 <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Huracán EVO" />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="year">Year</Label>
                 <Input id="year" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2023" />
               </div>
              <div className="space-y-2">
                <Label htmlFor="engine">Engine</Label>
                <Input id="engine" value={engine} onChange={(e) => setEngine(e.target.value)} placeholder="e.g. 5.2L V10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horsepower">Horsepower (hp)</Label>
                <Input id="horsepower" type="number" value={horsepower} onChange={(e) => setHorsepower(e.target.value)} placeholder="e.g. 610" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acceleration060">0-60 mph (s)</Label>
                 <Input id="acceleration060" type="number" step="0.1" value={acceleration060} onChange={(e) => setAcceleration060(e.target.value)} placeholder="e.g. 2.9" />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="topSpeed">Top Speed (mph)</Label>
                 <Input id="topSpeed" type="number" value={topSpeed} onChange={(e) => setTopSpeed(e.target.value)} placeholder="e.g. 201" />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="transmission">Transmission</Label>
                 <Input id="transmission" value={transmission} onChange={(e) => setTransmission(e.target.value)} placeholder="e.g. 7-speed dual-clutch" />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="drivetrain">Drivetrain</Label>
                 <Input id="drivetrain" value={drivetrain} onChange={(e) => setDrivetrain(e.target.value)} placeholder="e.g. All-wheel drive" />
               </div>
            </div>

            <Separator className="my-6" />

            <h3 className="text-lg font-medium mb-3">Additional Specifications</h3>
             {/* Dynamic Key-Value Specs (excluding core ones managed above) */}
              <div className="space-y-3 mb-4">
               <AnimatePresence>
                 {specifications
                   .filter(spec => !["make", "model", "year", "engine", "horsepower", "0-60 mph", "top speed", "transmission", "drivetrain"].includes(spec.name.toLowerCase()))
                   .map((spec) => (
                   <motion.div
                     key={spec.name} // Use name as key for dynamic specs
                     layout // Animate layout changes
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: "auto" }}
                     exit={{ opacity: 0, height: 0 }}
                     transition={{ type: "spring", stiffness: 500, damping: 30 }}
                     className="flex items-center gap-2"
                   >
                     <Input value={spec.name} disabled className="font-medium bg-muted/50" />
                     <Input value={spec.value} disabled className="bg-muted/50"/>
                     <Button
                       type="button"
                       variant="ghost"
                       size="icon"
                       onClick={() => removeSpecification(spec.name)}
                       className="text-muted-foreground hover:text-destructive shrink-0"
                     >
                       <X className="h-4 w-4" />
                     </Button>
                   </motion.div>
                 ))}
               </AnimatePresence>
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
                     if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) { // Check for simple Enter
                       e.preventDefault();
                       addSpecification();
                     }
                   }}
                 />
               </div>
               <Button type="button" onClick={addSpecification} variant="outline" size="icon" className="shrink-0">
                 <Plus className="h-4 w-4" />
               </Button>
             </div>

          </CardContent>
        </Card>

         {/* Features Card */}
         <Card>
           <CardContent className="p-6">
             <h2 className="text-xl font-semibold mb-4">Features</h2>
              <p className="text-sm text-muted-foreground mb-4">Highlight key features or amenities (e.g., Navigation, Bluetooth, Sunroof). Add a description if needed.</p>
              {/* Dynamic Key-Value Features */}
              <div className="space-y-3 mb-4">
                 <AnimatePresence>
                 {features.map((feature) => (
                   <motion.div
                     key={feature.name} // Use name as key
                     layout
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: "auto" }}
                     exit={{ opacity: 0, height: 0 }}
                     transition={{ type: "spring", stiffness: 500, damping: 30 }}
                     className="flex items-center gap-2"
                   >
                     <Input value={feature.name} disabled className="font-medium bg-muted/50" />
                     <Input value={feature.description || ""} disabled placeholder="(No description)" className="bg-muted/50"/>
                     <Button
                       type="button"
                       variant="ghost"
                       size="icon"
                       onClick={() => removeFeature(feature.name)}
                       className="text-muted-foreground hover:text-destructive shrink-0"
                     >
                       <X className="h-4 w-4" />
                     </Button>
                   </motion.div>
                 ))}
                 </AnimatePresence>
               </div>

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="new-feature-key" className="text-xs">Feature Name *</Label>
                  <Input
                    id="new-feature-key"
                    placeholder="e.g. Apple CarPlay"
                    value={newFeatureKey}
                    onChange={(e) => setNewFeatureKey(e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="new-feature-value" className="text-xs">Description (optional)</Label>
                  <Input
                     id="new-feature-value"
                    placeholder="e.g. Wireless" 
                    value={newFeatureValue}
                    onChange={(e) => setNewFeatureValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        addFeature();
                      }
                    }}
                  />
                </div>
                <Button type="button" onClick={addFeature} variant="outline" size="icon" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

           </CardContent>
         </Card>

        {/* Images Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-semibold">Images</h2>
                 <Label
                     htmlFor="image-upload"
                     className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 cursor-pointer"
                 >
                     <Upload className="mr-2 h-4 w-4" />
                     Upload
                 </Label>
                 <Input
                     id="image-upload"
                     type="file"
                     multiple
                     accept="image/png, image/jpeg, image/webp, image/gif"
                     onChange={handleImageUpload}
                     className="sr-only" // Hide the default input
                     disabled={isLoading}
                 />
            </div>

             <p className="text-sm text-muted-foreground mb-4">
                 Upload high-quality images (PNG, JPG, WEBP, GIF accepted, max 25MB recommended). The first image is the main image. Drag to reorder.
             </p>

             {formImages.length === 0 && (
                 <div className="text-center py-12 border-2 border-dashed rounded-lg">
                     <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                     <p className="text-muted-foreground mb-4">No images uploaded yet</p>
                     <Button variant="outline" onClick={() => document.getElementById('image-upload')?.click()} type="button">
                         Upload First Image
                     </Button>
                 </div>
             )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToParentElement]}
              >
                <SortableContext items={formImages.map((img, idx) => img.id || `new-${idx}`)} strategy={verticalListSortingStrategy}>
                  {formImages.map((imgData, index) => (
                    <SortableImage
                       key={imgData.id || `new-${index}`} // Use unique key
                       image={imgData}
                       index={index}
                       onRemove={removeImage}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

          </CardContent>
        </Card>

         {/* Visibility Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Visibility Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isAvailable" className="text-base">Available for Rent</Label>
                  <p className="text-sm text-muted-foreground">
                    Is this car currently available for customers to book?
                  </p>
                </div>
                <Switch id="isAvailable" checked={isAvailable} onCheckedChange={setIsAvailable} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isFeatured" className="text-base">Featured Car</Label>
                  <p className="text-sm text-muted-foreground">
                    Display this car prominently (e.g., on the homepage)?
                  </p>
                </div>
                <Switch id="isFeatured" checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isHidden" className="text-base">Hide from Public View</Label>
                  <p className="text-sm text-muted-foreground">Temporarily hide this car from public view (still accessible in admin)?</p>
                </div>
                <Switch id="isHidden" checked={isHidden} onCheckedChange={setIsHidden} />
              </div>
            </div>
          </CardContent>
        </Card>

         {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || formImages.some(img => img.isUploading)}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
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

