"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Calendar, Check, CreditCard, FileText, Mail, Phone, User, MapPin, Loader2 } from "lucide-react"

interface BookingDetail {
  id: string
  carId: string
  car: {
    id: string
    name: string
    slug: string
    model: string
    make: string
    year: number
    pricePerDay: number
    mainImageUrl?: string
    description?: string
  } | null
  customer: {
    id: string
    firstName: string
    lastName: string
    fullName: string
    email: string
    phone?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
    driversLicense?: string
    createdAt: string
  } | null
  startDate: string
  endDate: string
  totalPrice: number
  currency: string
  securityDepositAmount: number
  overallStatus: string
  paymentStatus: string
  contractStatus: string
  pickupLocation?: string
  dropoffLocation?: string
  notes?: string
  adminNotes?: string
  createdAt: string
  updatedAt: string
  bookingDays: number
  payments: Array<{
    id: string
    amount: number
    status: string
    paymentMethod: string
    transactionId?: string
    gatewayResponse?: any
    createdAt: string
    updatedAt: string
  }>
  timeline: Array<{
    id: string
    eventType: string
    timestamp: string
    actorType: string
    actorId?: string
    metadata?: any
    createdAt: string
  }>
  secureTokens: Array<{
    id: string
    token: string
    createdAt: string
    expiresAt: string
  }>
  media: Array<{
    id: string
    mediaType: string
    fileUrl: string
    fileName: string
    fileSize: number
    uploadedAt: string
    uploadedByType: string
    uploadedById?: string
    metadata?: any
  }>
  disputes: Array<{
    id: string
    disputeStatus: string
    reason: string
    amount: number
    providerDisputeId?: string
    createdAt: string
    updatedAt: string
    resolvedAt?: string
  }>
  bookingUrl?: string
}

export default function BookingDetailPage({ params }: { params: { bookingId: string } }) {
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBookingDetail = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/admin/bookings/${params.bookingId}`)
        
        if (response.status === 404) {
          notFound()
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch booking: ${response.statusText}`)
        }
        
        const data: BookingDetail = await response.json()
        setBooking(data)
      } catch (err) {
        console.error('Error fetching booking detail:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch booking')
      } finally {
        setLoading(false)
      }
    }

    fetchBookingDetail()
  }, [params.bookingId])

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
    return new Date(dateString).toLocaleDateString("en-US", options)
  }

  const formatDateTime = (dateTimeString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
    return new Date(dateTimeString).toLocaleDateString("en-US", options)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "upcoming":
        return "bg-blue-100 text-blue-800"
      case "completed":
        return "bg-gray-100 text-gray-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "authorized":
        return "bg-yellow-100 text-yellow-800"
      case "captured":
      case "paid":
        return "bg-green-100 text-green-800"
      case "pending":
      case "pending_payment":
      case "pending_contract":
        return "bg-orange-100 text-orange-800"
      case "signed":
      case "not_sent":
      case "sent":
      case "verified":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getEventTypeLabel = (eventType: string) => {
    const eventLabels: Record<string, string> = {
      'booking_created': 'Booking Created',
      'payment_authorized': 'Payment Authorized',
      'payment_captured': 'Payment Captured',
      'contract_sent': 'Contract Sent',
      'contract_signed': 'Contract Signed',
      'booking_confirmed': 'Booking Confirmed',
      'car_picked_up': 'Car Picked Up',
      'car_returned': 'Car Returned',
      'booking_completed': 'Booking Completed',
      'booking_cancelled': 'Booking Cancelled',
      'admin_updated_booking': 'Admin Updated Booking',
      'booking_status_changed': 'Status Changed',
      'dispute_created': 'Dispute Created',
      'dispute_resolved': 'Dispute Resolved'
    }
    return eventLabels[eventType] || eventType.replace(/_/g, ' ')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="ghost" asChild className="mr-4">
            <Link href="/admin/bookings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Bookings
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Booking Details</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading booking details...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="ghost" asChild className="mr-4">
            <Link href="/admin/bookings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Bookings
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Booking Details</h1>
        </div>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    )
  }

  if (!booking) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" asChild className="mr-4">
          <Link href="/admin/bookings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bookings
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Booking Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl">Booking Summary</CardTitle>
              <div className="flex gap-2">
                <Badge className={getStatusColor(booking.overallStatus)}>
                  {booking.overallStatus.charAt(0).toUpperCase() + booking.overallStatus.slice(1)}
                </Badge>
                <Badge className={getStatusColor(booking.paymentStatus)}>
                  Payment: {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
                </Badge>
                <Badge className={getStatusColor(booking.contractStatus)}>
                  Contract: {booking.contractStatus.charAt(0).toUpperCase() + booking.contractStatus.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="relative w-full md:w-48 h-32 rounded-md overflow-hidden">
                  <Image
                    src={booking.car?.mainImageUrl || "/placeholder.svg"}
                    alt={booking.car?.name || "Car"}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-semibold">{booking.car?.name || 'Unknown Car'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {booking.car?.year} {booking.car?.make} {booking.car?.model}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">
                        {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {booking.bookingDays} {booking.bookingDays === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">Daily Rate: ${booking.car?.pricePerDay}</span>
                    <span className="text-lg font-semibold">Total: ${booking.totalPrice}</span>
                  </div>
                </div>
              </div>

              {(booking.pickupLocation || booking.dropoffLocation) && (
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {booking.pickupLocation && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">Pickup Location</p>
                          <p className="text-sm text-muted-foreground">{booking.pickupLocation}</p>
                        </div>
                      </div>
                    )}
                    {booking.dropoffLocation && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-red-600" />
                        <div>
                          <p className="text-sm font-medium">Dropoff Location</p>
                          <p className="text-sm text-muted-foreground">{booking.dropoffLocation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(booking.notes || booking.adminNotes) && (
                <div className="pt-4 border-t space-y-3">
                  {booking.notes && (
                    <div>
                      <p className="text-sm font-medium">Customer Notes</p>
                      <p className="text-sm text-muted-foreground">{booking.notes}</p>
                    </div>
                  )}
                  {booking.adminNotes && (
                    <div>
                      <p className="text-sm font-medium">Admin Notes</p>
                      <p className="text-sm text-muted-foreground">{booking.adminNotes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t flex gap-2">
                <Button size="sm">Update Status</Button>
                <Button variant="outline" size="sm">Edit Booking</Button>
                {booking.overallStatus === "completed" && booking.paymentStatus === "authorized" && (
                  <Button variant="outline" size="sm">
                    Capture Payment
                  </Button>
                )}
                {booking.bookingUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={booking.bookingUrl} target="_blank">
                      Customer View
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {booking.timeline.length > 0 ? (
                  booking.timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                        {index < booking.timeline.length - 1 && <div className="w-0.5 bg-gray-200 flex-grow mt-2"></div>}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{getEventTypeLabel(event.eventType)}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(event.timestamp)}
                          </p>
                        </div>
                        {event.metadata && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {JSON.stringify(event.metadata, null, 2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No timeline events available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">{booking.customer?.fullName || 'Unknown Customer'}</p>
                  <p className="text-sm text-muted-foreground">ID: {booking.customer?.id}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="text-sm">{booking.customer?.email}</p>
                </div>
              </div>

              {booking.customer?.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 mt-0.5" />
                  <div>
                    <p className="text-sm">{booking.customer.phone}</p>
                  </div>
                </div>
              )}

              {booking.customer?.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 mt-0.5" />
                  <div>
                    <p className="text-sm">{booking.customer.address}</p>
                    {booking.customer.city && booking.customer.state && (
                      <p className="text-sm text-muted-foreground">
                        {booking.customer.city}, {booking.customer.state} {booking.customer.zipCode}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {booking.customer?.driversLicense && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Driver's License</p>
                    <p className="text-sm text-muted-foreground">{booking.customer.driversLicense}</p>
                  </div>
                </div>
              )}

              <Separator />
              <div>
                <p className="text-sm font-medium">Customer Since</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(booking.customer?.createdAt || booking.createdAt)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Subtotal:</span>
                <span className="text-sm">${booking.totalPrice}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Security Deposit:</span>
                <span className="text-sm">${booking.securityDepositAmount}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-medium">
                <span>Total:</span>
                <span>${booking.totalPrice + booking.securityDepositAmount}</span>
              </div>

              {booking.payments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Payment History</p>
                    <div className="space-y-2">
                      {booking.payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between text-sm">
                          <div>
                            <p>{payment.paymentMethod}</p>
                            <p className="text-muted-foreground text-xs">
                              {formatDateTime(payment.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p>${payment.amount}</p>
                            <Badge className={getStatusColor(payment.status)} variant="secondary">
                              {payment.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" size="sm">
                Send Email
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                Generate Invoice
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                Download Contract
              </Button>
              <Button variant="destructive" className="w-full" size="sm">
                Cancel Booking
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}