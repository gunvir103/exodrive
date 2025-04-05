"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
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
import type { DateAvailability, CarPricing } from "@/lib/types/car"
import { useMediaQuery } from "@/hooks/use-media-query"

interface BookingFormProps {
  carId: string
  pricing: CarPricing
  availability?: DateAvailability[]
}

export function CarBookingForm({ carId, pricing, availability = [] }: BookingFormProps) {
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    termsAccepted: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const { toast } = useToast()
  const isMobile = useMediaQuery("(max-width: 640px)")

  // Calculate rental days and total price
  const days = startDate && endDate ? Math.max(1, differenceInDays(endDate, startDate) + 1) : 0
  const totalPrice = days * pricing.basePrice
  const depositAmount = pricing.depositAmount || Math.round(totalPrice * 0.3)

  // Get today and tomorrow for date constraints
  const today = new Date()
  const tomorrow = addDays(today, 1)

  // Get dates 3 months from now for max date constraint
  const maxDate = addDays(today, 90)

  // Function to check if a date is available
  const isDateAvailable = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    const dateAvailability = availability.find((a) => a.date === dateStr)
    return !dateAvailability || dateAvailability.status === "available"
  }

  // Function to get date class names based on availability
  const getDateClassName = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    const dateAvailability = availability.find((a) => a.date === dateStr)

    if (!dateAvailability) return ""

    switch (dateAvailability.status) {
      case "booked":
        return "bg-red-100 text-red-800"
      case "maintenance":
        return "bg-orange-100 text-orange-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return ""
    }
  }

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
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

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required"
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid"
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required"
    }

    if (!formData.termsAccepted) {
      newErrors.termsAccepted = "You must accept the terms"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()

    if (step === 2 && !validateForm()) {
      toast({
        title: "Form Error",
        description: "Please fill in all required fields correctly",
        variant: "destructive",
      })
      return
    }

    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both pickup and return dates",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Prepare booking data
      const bookingData = {
        carId,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        totalPrice,
        depositAmount,
        customer: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
        },
      }

      // In a real app, this would be an API call to create a booking
      console.log("Booking data:", bookingData)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // This would redirect to a checkout page with Stripe in a real app
      toast({
        title: "Booking initiated",
        description: "You'll be redirected to complete your booking",
      })

      setIsSuccess(true)
    } catch (error) {
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

  // Reset form when component unmounts
  useEffect(() => {
    return () => {
      setStartDate(undefined)
      setEndDate(undefined)
      setStep(1)
      setIsSuccess(false)
    }
  }, [])

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
        <p className="text-muted-foreground mb-6 text-sm">
          Your booking request has been received. You'll be redirected to complete your reservation.
        </p>
        <Button className="w-full bg-white text-black hover:bg-gray-100 rounded-full" disabled>
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
            <div className="bg-muted/50 p-3 rounded-lg mb-4">
              <h3 className="font-medium flex items-center text-sm mb-1">
                <Info className="h-4 w-4 mr-1.5 text-primary" />
                Booking Information
              </h3>
              <p className="text-xs text-muted-foreground">
                Select your rental dates below. A {Math.round((depositAmount / totalPrice || 0.3) * 100)}% deposit is
                required to secure your booking.
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
                      "w-full justify-start text-left font-normal text-sm",
                      !startDate && "text-muted-foreground",
                      startDate && "border-primary",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "EEEE, MMMM d, yyyy") : "Select pickup date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side={isMobile ? "bottom" : "start"}>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (!date) return
                      setStartDate(date)
                      // If end date is before start date, reset it
                      if (endDate && isBefore(endDate, date)) {
                        setEndDate(undefined)
                      } else if (!endDate) {
                        // Suggest an end date 3 days after start date
                        setEndDate(addDays(date, 3))
                      }
                    }}
                    initialFocus
                    disabled={(date) => isBefore(date, today) || isAfter(date, maxDate) || !isDateAvailable(date)}
                    modifiers={{
                      booked: (date) => !isDateAvailable(date),
                    }}
                    modifiersClassNames={{
                      booked: "text-red-500 line-through",
                    }}
                    className="rounded-md border"
                    components={{
                      Day: (props) => {
                        const dateClassName = getDateClassName(props.date)
                        return <button {...props} className={cn(props.className, dateClassName)} />
                      },
                    }}
                    showOutsideDays={true}
                    fixedWeeks={true}
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
                      "w-full justify-start text-left font-normal text-sm",
                      !endDate && "text-muted-foreground",
                      endDate && "border-primary",
                    )}
                    disabled={!startDate}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "EEEE, MMMM d, yyyy") : "Select return date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side={isMobile ? "bottom" : "start"}>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    disabled={(date) =>
                      !startDate || isBefore(date, startDate) || isAfter(date, maxDate) || !isDateAvailable(date)
                    }
                    modifiers={{
                      booked: (date) => !isDateAvailable(date),
                    }}
                    modifiersClassNames={{
                      booked: "text-red-500 line-through",
                    }}
                    className="rounded-md border"
                    components={{
                      Day: (props) => {
                        const dateClassName = getDateClassName(props.date)
                        return <button {...props} className={cn(props.className, dateClassName)} />
                      },
                    }}
                    showOutsideDays={true}
                    fixedWeeks={true}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {days > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Daily Rate:</span>
                    <span>${pricing.basePrice.toLocaleString()}/day</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Duration:</span>
                    <span>
                      {days} day{days !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {pricing.additionalFees
                    .filter((fee) => !fee.isOptional)
                    .map((fee) => (
                      <div key={fee.id} className="flex justify-between text-xs">
                        <span>{fee.name}:</span>
                        <span>${fee.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold text-sm">
                    <span>Total:</span>
                    <span>
                      $
                      {(
                        totalPrice +
                        pricing.additionalFees
                          .filter((fee) => !fee.isOptional)
                          .reduce((sum, fee) => sum + fee.amount, 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-2">
              <Button
                className="w-full bg-white text-black hover:bg-gray-100 rounded-full text-sm"
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
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">
                Back to Dates
              </Button>
            </div>

            <form ref={formRef} onSubmit={handleBooking} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-xs">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    placeholder="John"
                    className={cn("text-sm h-9", errors.firstName && "border-red-500")}
                    value={formData.firstName}
                    onChange={handleInputChange}
                    autoComplete="given-name"
                  />
                  {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-xs">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    placeholder="Doe"
                    className={cn("text-sm h-9", errors.lastName && "border-red-500")}
                    value={formData.lastName}
                    onChange={handleInputChange}
                    autoComplete="family-name"
                  />
                  {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  className={cn("text-sm h-9", errors.email && "border-red-500")}
                  value={formData.email}
                  onChange={handleInputChange}
                  autoComplete="email"
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(123) 456-7890"
                  className={cn("text-sm h-9", errors.phone && "border-red-500")}
                  value={formData.phone}
                  onChange={handleInputChange}
                  autoComplete="tel"
                  inputMode="tel"
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
              </div>

              <div className="flex items-start space-x-2 pt-1">
                <Checkbox
                  id="termsAccepted"
                  name="termsAccepted"
                  checked={formData.termsAccepted}
                  onCheckedChange={(checked) => {
                    setFormData((prev) => ({
                      ...prev,
                      termsAccepted: checked === true,
                    }))
                    if (errors.termsAccepted) {
                      setErrors((prev) => {
                        const newErrors = { ...prev }
                        delete newErrors.termsAccepted
                        return newErrors
                      })
                    }
                  }}
                  className={errors.termsAccepted ? "border-red-500" : ""}
                />
                <div className="space-y-1">
                  <Label htmlFor="termsAccepted" className={cn("text-xs", errors.termsAccepted && "text-red-500")}>
                    I agree to the{" "}
                    <a href="#" className="text-primary underline">
                      Terms & Conditions
                    </a>{" "}
                    and{" "}
                    <a href="#" className="text-primary underline">
                      Privacy Policy
                    </a>
                  </Label>
                  {errors.termsAccepted && <p className="text-xs text-red-500">{errors.termsAccepted}</p>}
                </div>
              </div>

              <Separator className="my-1" />

              <div className="bg-muted rounded-lg p-3 space-y-2">
                <h4 className="font-medium text-sm">Booking Summary</h4>

                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1.5 text-primary" />
                    <span>Pickup Date:</span>
                  </div>
                  <span className="font-medium">{startDate ? format(startDate, "MMM d, yyyy") : ""}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1.5 text-primary" />
                    <span>Return Date:</span>
                  </div>
                  <span className="font-medium">{endDate ? format(endDate, "MMM d, yyyy") : ""}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center">
                    <Shield className="h-3 w-3 mr-1.5 text-primary" />
                    <span>Duration:</span>
                  </div>
                  <span className="font-medium">
                    {days} day{days !== 1 ? "s" : ""}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-xs">
                  <span>Daily Rate:</span>
                  <span>${pricing.basePrice.toLocaleString()}/day</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Subtotal:</span>
                  <span>${totalPrice.toLocaleString()}</span>
                </div>
                {pricing.additionalFees.map((fee) => (
                  <div key={fee.id} className="flex justify-between text-xs">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center">
                          <span>
                            {fee.name}
                            {fee.isOptional ? " (optional)" : ""}:
                          </span>
                          <Info className="h-3 w-3 ml-1 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">{fee.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span>${fee.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs">
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
                <div className="flex justify-between font-bold pt-1 border-t text-sm">
                  <span>Due Today:</span>
                  <span>${depositAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1 text-xs h-9" onClick={() => setStep(1)}>
                  Back
                </Button>
                <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    className="w-full bg-white text-black hover:bg-gray-100 rounded-full text-xs h-9"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-3 w-3 text-black"
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
                        <CreditCard className="mr-2 h-3 w-3" />
                        Complete Booking
                      </span>
                    )}
                  </Button>
                </motion.div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {step === 1 && (
        <div className="flex items-center justify-center space-x-2 pt-1">
          <Shield className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">Secure booking with 100% refundable deposit</p>
        </div>
      )}
    </div>
  )
}

