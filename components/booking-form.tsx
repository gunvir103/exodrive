"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, differenceInDays, addDays, isBefore, isAfter } from "date-fns"
import { CalendarIcon, CheckCircle, Shield, Clock, CreditCard, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

interface BookingFormProps {
  carId: string
  price: number
}

export function BookingForm({ carId, price }: BookingFormProps) {
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [step, setStep] = useState(1)
  const { toast } = useToast()

  // State for form inputs
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    termsAccepted: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Calculate rental days and total price
  const days = startDate && endDate ? Math.max(1, differenceInDays(endDate, startDate) + 1) : 0
  const totalPrice = days * price
  const depositAmount = Math.round(totalPrice * 0.3)

  // Get today and tomorrow for date constraints
  const today = new Date()
  const tomorrow = addDays(today, 1)

  // Get dates 3 months from now for max date constraint
  const maxDate = addDays(today, 90)

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked // For checkbox
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required"
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required"
    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid"
    }
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required" // Optional based on your needs
    if (!formData.termsAccepted) newErrors.termsAccepted = "You must accept the terms"
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBooking = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both pickup and return dates",
        variant: "destructive",
      })
      return
    }

    if (!validateForm()) {
      toast({
        title: "Form Error",
        description: "Please correct the errors in the form.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const bookingPayload = {
        carId,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        totalPrice,
        // currency and notes can be added if needed, default to USD and null respectively in API
      }

      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingPayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Booking creation failed")
      }

      // const result = await response.json() // Contains { success: true, booking: ... }

      toast({
        title: "Booking Initiated!",
        description: "Your booking request has been received. We will contact you shortly.",
      })
      setIsSuccess(true)
    } catch (error: any) {
      console.error("Booking error:", error)
      toast({
        title: "Booking failed",
        description: "There was an error processing your booking. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4"
        >
          <CheckCircle className="h-8 w-8 text-green-600" />
        </motion.div>
        <h3 className="text-xl font-bold mb-2">Booking Initiated!</h3>
        <p className="text-muted-foreground mb-6">
          Your booking request has been received. You'll be redirected to complete your reservation.
        </p>
        <Button className="w-full gradient-primary rounded-full" disabled>
          Processing...
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="bg-muted/50 p-4 rounded-lg mb-6">
              <h3 className="font-medium flex items-center mb-2">
                <Info className="h-4 w-4 mr-2 text-primary" />
                Booking Information
              </h3>
              <p className="text-sm text-muted-foreground">
                Select your rental dates below. A 30% deposit is required to secure your booking.
              </p>
            </div>

            <div>
              <Label htmlFor="pickup-date" className="text-sm font-medium mb-1.5 flex items-center">
                <Clock className="h-4 w-4 mr-1.5 text-primary" />
                Pickup Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="pickup-date"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground",
                      startDate && "border-primary",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "EEEE, MMMM d, yyyy") : "Select pickup date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date)
                      // If end date is before start date, reset it
                      if (endDate && date && isAfter(date, endDate)) {
                        setEndDate(undefined)
                      } else if (date) {
                        // Suggest an end date 3 days after start date
                        setEndDate(addDays(date, 3))
                      }
                    }}
                    initialFocus
                    disabled={(date) => isBefore(date, today) || isAfter(date, maxDate)}
                    className="rounded-md border"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="return-date" className="text-sm font-medium mb-1.5 flex items-center">
                <Clock className="h-4 w-4 mr-1.5 text-primary" />
                Return Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="return-date"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground",
                      endDate && "border-primary",
                    )}
                    disabled={!startDate}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "EEEE, MMMM d, yyyy") : "Select return date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    disabled={(date) => !startDate || isBefore(date, startDate) || isAfter(date, maxDate)}
                    className="rounded-md border"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {days > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Daily Rate:</span>
                    <span>${price.toLocaleString()}/day</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Duration:</span>
                    <span>
                      {days} day{days !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>${totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-2">
              <Button
                className="w-full gradient-primary rounded-full"
                size="lg"
                onClick={() => days > 0 && setStep(2)}
                disabled={!startDate || !endDate}
              >
                Continue to Details
              </Button>
            </motion.div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Personal Information</h3>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                Back to Dates
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input id="first-name" name="firstName" placeholder="John" value={formData.firstName} onChange={handleInputChange} />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input id="last-name" name="lastName" placeholder="Doe" value={formData.lastName} onChange={handleInputChange} />
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" placeholder="john.doe@example.com" value={formData.email} onChange={handleInputChange} />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" name="phone" type="tel" placeholder="(123) 456-7890" value={formData.phone} onChange={handleInputChange} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="terms" name="termsAccepted" checked={formData.termsAccepted} onCheckedChange={(checked) => setFormData(prev => ({...prev, termsAccepted: Boolean(checked)}))} />
                <Label htmlFor="terms" className="text-sm">
                  I agree to the{" "}
                  <a href="#" className="text-primary underline">
                    Terms &amp; Conditions
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-primary underline">
                    Privacy Policy
                  </a>
                </Label>
              </div>
              {errors.termsAccepted && <p className="text-xs text-destructive pt-1">{errors.termsAccepted}</p>}
            </div>

            <Separator className="my-2" />

            <div className="bg-muted rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Booking Summary</h4>

              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-primary" />
                  <span className="text-sm">Pickup Date:</span>
                </div>
                <span className="font-medium">{startDate ? format(startDate, "MMM d, yyyy") : ""}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-primary" />
                  <span className="text-sm">Return Date:</span>
                </div>
                <span className="font-medium">{endDate ? format(endDate, "MMM d, yyyy") : ""}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-2 text-primary" />
                  <span className="text-sm">Duration:</span>
                </div>
                <span className="font-medium">
                  {days} day{days !== 1 ? "s" : ""}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span>Daily Rate:</span>
                <span>${price.toLocaleString()}/day</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center">
                      <span>Security Deposit (refundable):</span>
                      <Info className="h-3 w-3 ml-1 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        A refundable security deposit is required at pickup. This amount will be returned upon vehicle
                        return, subject to our terms and conditions.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span>${depositAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Due Today:</span>
                <span>${depositAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="w-full gradient-primary rounded-full" onClick={handleBooking} disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Complete Booking
                    </span>
                  )}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step === 1 && (
        <div className="flex items-center justify-center space-x-2 pt-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">Secure booking with 100% refundable deposit</p>
        </div>
      )}
    </div>
  )
}

