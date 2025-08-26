'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, CreditCard, User, Car, Clock, Shield, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface SelectedCarData {
  carId: string
  carName: string
  carSlug: string
  pricePerDay: number
  pickupDate?: string
  dropoffDate?: string
}

interface BookingForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  driverLicense: string
  pickupDate: string
  dropoffDate: string
  notes: string
}

export function BookingClient() {
  const [selectedCar, setSelectedCar] = useState<SelectedCarData | null>(null)
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    driverLicense: '',
    pickupDate: '',
    dropoffDate: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'details' | 'payment'>('details')
  const router = useRouter()
  const { toast } = useToast()

  // Load selected car data from session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCarData = sessionStorage.getItem('selectedCar')
      if (storedCarData) {
        try {
          const carData: SelectedCarData = JSON.parse(storedCarData)
          setSelectedCar(carData)
          
          // Pre-fill dates if available
          if (carData.pickupDate && carData.dropoffDate) {
            setBookingForm(prev => ({
              ...prev,
              pickupDate: new Date(carData.pickupDate).toISOString().split('T')[0],
              dropoffDate: new Date(carData.dropoffDate).toISOString().split('T')[0]
            }))
          }
        } catch (error) {
          console.error('Error parsing selected car data:', error)
        }
      }
    }
  }, [])

  const handleInputChange = useCallback((field: keyof BookingForm, value: string) => {
    setBookingForm(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

  const calculateRentalDays = useCallback(() => {
    if (!bookingForm.pickupDate || !bookingForm.dropoffDate) return 0
    
    const pickup = new Date(bookingForm.pickupDate)
    const dropoff = new Date(bookingForm.dropoffDate)
    const diffTime = Math.abs(dropoff.getTime() - pickup.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(1, diffDays)
  }, [bookingForm.pickupDate, bookingForm.dropoffDate])

  const calculateTotal = useCallback(() => {
    if (!selectedCar) return 0
    const days = calculateRentalDays()
    return days * selectedCar.pricePerDay
  }, [selectedCar, calculateRentalDays])

  const rentalDays = calculateRentalDays()
  const totalPrice = calculateTotal()

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedCar) {
      toast({
        title: "Error",
        description: "No car selected. Please go back and select a car.",
        variant: "destructive"
      })
      return
    }

    // Validate form
    const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'pickupDate', 'dropoffDate']
    const missingFields = requiredFields.filter(field => !bookingForm[field as keyof BookingForm])
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Information",
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: "destructive"
      })
      return
    }

    // Validate dates
    const pickupDate = new Date(bookingForm.pickupDate)
    const dropoffDate = new Date(bookingForm.dropoffDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (pickupDate < today) {
      toast({
        title: "Invalid Date",
        description: "Pickup date cannot be in the past.",
        variant: "destructive"
      })
      return
    }

    if (dropoffDate <= pickupDate) {
      toast({
        title: "Invalid Date",
        description: "Drop-off date must be after pickup date.",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Create booking
      const bookingData = {
        carId: selectedCar.carId,
        startDate: bookingForm.pickupDate,
        endDate: bookingForm.dropoffDate,
        totalPrice,
        currency: 'USD',
        customerInfo: {
          firstName: bookingForm.firstName,
          lastName: bookingForm.lastName,
          email: bookingForm.email,
          phone: bookingForm.phone,
          driverLicense: bookingForm.driverLicense
        },
        notes: bookingForm.notes
      }

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create booking')
      }

      // Track successful booking
      import("@/lib/analytics/track-events").then(({ trackBookingComplete }) => {
        trackBookingComplete?.(
          selectedCar.carId,
          selectedCar.carName,
          totalPrice,
          rentalDays
        );
      });

      // Clear session data
      sessionStorage.removeItem('selectedCar')

      // Redirect to confirmation page or payment
      if (result.bookingId) {
        toast({
          title: "Success!",
          description: "Your booking has been created. Redirecting to confirmation...",
        })
        
        // Redirect to booking confirmation (assuming there's a token-based confirmation)
        router.push(`/booking/confirmation?id=${result.bookingId}`)
      }

    } catch (error) {
      console.error('Booking error:', error)
      toast({
        title: "Booking Failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedCar, bookingForm, totalPrice, rentalDays, toast, router])

  // If no car selected, show message to go back
  if (!selectedCar) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <CardTitle>No Car Selected</CardTitle>
          <CardDescription>
            Please select a car from our fleet first.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
            <Link href="/cars">Browse Cars</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Booking Form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Back Link */}
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Car Details
          </Button>
        </div>

        {/* Booking Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={bookingForm.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={bookingForm.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={bookingForm.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={bookingForm.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="driverLicense">Driver's License Number</Label>
                <Input
                  id="driverLicense"
                  value={bookingForm.driverLicense}
                  onChange={(e) => handleInputChange('driverLicense', e.target.value)}
                  placeholder="Required for verification"
                />
              </div>
            </CardContent>
          </Card>

          {/* Rental Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Rental Period
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickupDate">Pickup Date *</Label>
                <Input
                  id="pickupDate"
                  type="date"
                  value={bookingForm.pickupDate}
                  onChange={(e) => handleInputChange('pickupDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dropoffDate">Drop-off Date *</Label>
                <Input
                  id="dropoffDate"
                  type="date"
                  value={bookingForm.dropoffDate}
                  onChange={(e) => handleInputChange('dropoffDate', e.target.value)}
                  min={bookingForm.pickupDate || new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes">Special Requests or Notes</Label>
                <Textarea
                  id="notes"
                  value={bookingForm.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Any special requests, delivery instructions, or questions..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Terms and Submit */}
          <Card>
            <CardContent className="pt-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  By proceeding, you agree to our terms and conditions. Your booking is subject to availability and verification.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processing..." : `Confirm Booking - $${totalPrice}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>

      {/* Booking Summary Sidebar */}
      <div className="space-y-6">
        {/* Car Summary */}
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Car className="mr-2 h-5 w-5" />
              Booking Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Car Info */}
            <div>
              <h3 className="font-semibold text-lg">{selectedCar.carName}</h3>
              <Badge variant="outline" className="mt-1">Premium Vehicle</Badge>
            </div>

            <Separator />

            {/* Rental Details */}
            <div className="space-y-3">
              {bookingForm.pickupDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pickup:</span>
                  <span>{format(new Date(bookingForm.pickupDate), 'MMM dd, yyyy')}</span>
                </div>
              )}
              {bookingForm.dropoffDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Drop-off:</span>
                  <span>{format(new Date(bookingForm.dropoffDate), 'MMM dd, yyyy')}</span>
                </div>
              )}
              {rentalDays > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration:</span>
                  <span>{rentalDays} day{rentalDays !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Pricing */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Daily Rate:</span>
                <span>${selectedCar.pricePerDay}/day</span>
              </div>
              {rentalDays > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({rentalDays} days):</span>
                  <span>${totalPrice}</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex justify-between text-lg font-semibold">
              <span>Total:</span>
              <span>${totalPrice}</span>
            </div>

            {/* Included Features */}
            <div className="text-xs text-muted-foreground space-y-1 mt-4">
              <div className="flex items-center">
                <Shield className="mr-1 h-3 w-3" />
                Premium insurance included
              </div>
              <div className="flex items-center">
                <Clock className="mr-1 h-3 w-3" />
                24/7 roadside assistance
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}