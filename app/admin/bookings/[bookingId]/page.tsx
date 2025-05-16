"use client";

import Link from "next/link"
import Image from "next/image"
import { notFound, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Calendar, Check, CreditCard, FileText, Mail, Phone, User, MapPin, AlertTriangle, ThumbsUp, ThumbsDown, Edit3, Ban, History, Loader2 } from "lucide-react"
import { fetchBookingById } from "@/lib/queries/bookings"
import { format, parseISO } from "date-fns"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface BookingActionsProps {
  booking: any; // TODO: Type this properly based on fetched booking data
}

// This component would ideally be a client component for actual interactions
function BookingActionButtons({ booking }: BookingActionsProps) {
  const [isLoading, setIsLoading] = useState<string | false>(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleStatusUpdate = async (newStatus: string, paymentStatus?: string) => {
    const actionKey = `${newStatus}${paymentStatus || ''}`;
    setIsLoading(actionKey);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, payment_status: paymentStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }
      const updatedBooking = await response.json();
      toast({ title: "Status Updated", description: `Booking ${booking.id} moved to ${updatedBooking.status}.` });
      router.refresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  // New: Handler for unimplemented features
  const handleNotImplemented = (feature: string) => {
    toast({
      title: 'Not Implemented',
      description: `${feature} is not available yet.`,
      variant: 'default',
    });
  };

  const renderButton = (label: string, newStatus: string, paymentStatus?: string, icon?: React.ReactNode, variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null, className?: string) => {
    const actionKey = `${newStatus}${paymentStatus || ''}`;
    const specificLoading = isLoading === actionKey;
    return (
      <Button 
        className={`w-full ${className || ''}`} 
        onClick={() => handleStatusUpdate(newStatus, paymentStatus)}
        disabled={!!isLoading}
        variant={variant || "default"}
      >
        {specificLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : icon}
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {booking.status === 'pending' && (
        <>
          {renderButton("Approve Booking", 'authorized', undefined, <ThumbsUp className="mr-2 h-4 w-4" />, "default", "bg-green-600 hover:bg-green-700")}
          {renderButton("Reject Booking", 'cancelled', undefined, <ThumbsDown className="mr-2 h-4 w-4" />, "destructive")}
        </>
      )}

      {booking.status === 'authorized' && (
        renderButton("Mark as Booked & Capture Payment", 'booked', 'captured', <Check className="mr-2 h-4 w-4" />, "default", "bg-blue-600 hover:bg-blue-700")
      )}

      {booking.status === 'active' && (
        renderButton("Mark as Completed", 'completed', undefined, <Check className="mr-2 h-4 w-4" />)
      )}
      
      {booking.status !== 'cancelled' && booking.status !== 'completed' && (
        <Button variant="outline" className="w-full" onClick={() => handleNotImplemented('Edit Booking')} disabled={!!isLoading}>
          <Edit3 className="mr-2 h-4 w-4" /> Edit Booking (Not Implemented)
        </Button>
      )}

      {booking.payment_status === 'authorized' && booking.status !== 'completed' && booking.status !== 'cancelled' && (
        renderButton("Capture Payment Manually", booking.status, 'captured', <CreditCard className="mr-2 h-4 w-4" />)
      )}

      {booking.status !== 'cancelled' && booking.status !== 'completed' && (
        renderButton("Cancel Booking", 'cancelled', undefined, <Ban className="mr-2 h-4 w-4" />, "destructive")
      )}
      <Button variant="outline" className="w-full" onClick={() => handleNotImplemented('Send Email to Customer')} disabled={!!isLoading}>Send Email to Customer</Button>
      <Button variant="outline" className="w-full" onClick={() => handleNotImplemented('Print Booking Details')} disabled={!!isLoading}>Print Booking Details</Button>
    </div>
  )
}

export const dynamic = 'force-dynamic' // Ensure fresh data on each request

export default async function BookingDetailPage({ params }: { params: { bookingId: string } }) {
  const bookingId = params.bookingId
  let booking: any = null // Initialize booking as any or a proper type
  let fetchError: string | null = null

  try {
    booking = await fetchBookingById(bookingId)
  } catch (error: any) {
    console.error(`Failed to fetch booking ${bookingId}:`, error)
    fetchError = error.message
  }

  if (fetchError) {
    return (
      <div className="container mx-auto py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold text-destructive">Error Loading Booking</h1>
        <p className="mt-2 text-muted-foreground">{fetchError}</p>
        <Button asChild className="mt-6">
          <Link href="/admin/bookings">Back to Bookings</Link>
        </Button>
      </div>
    )
  }
  
  if (!booking) {
    notFound()
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A"
    try {
      const date = parseISO(dateString)
      if (isNaN(date.getTime())) return "Invalid Date"
      return format(date, "MMM d, yyyy")
    } catch (e) {
      return "Invalid Date"
    }
  }

  const formatDateTime = (dateTimeString: string | null | undefined) => {
    if (!dateTimeString) return "N/A"
    try {
      const date = parseISO(dateTimeString)
      if (isNaN(date.getTime())) return "Invalid Date"
      return format(date, "MMM d, yyyy, p")
    } catch (e) {
      return "Invalid Date"
    }
  }

  const getStatusBadgeVariant = (status: string | null | undefined): string => {
    switch (status?.toLowerCase()) {
      case "active": return "bg-green-100 text-green-800"
      case "upcoming": return "bg-blue-100 text-blue-800" // Note: 'upcoming' from db enum
      case "booked": return "bg-sky-100 text-sky-800" // 'booked' is a valid status
      case "completed": return "bg-gray-100 text-gray-800"
      case "cancelled": return "bg-red-100 text-red-800"
      case "authorized": return "bg-yellow-100 text-yellow-800"
      case "pending": return "bg-orange-100 text-orange-800" // For display, if data somehow has it
      // Payment statuses for payment badge
      case "captured": return "bg-green-100 text-green-800"
      case "refunded": return "bg-purple-100 text-purple-800"
      case "voided": return "bg-gray-100 text-gray-500"
      default: return "bg-gray-200 text-gray-700"
    }
  }

  // Calculate total days if possible
  const totalDays = booking.start_date && booking.end_date ? 
    (parseISO(booking.end_date).getTime() - parseISO(booking.start_date).getTime()) / (1000 * 3600 * 24) + 1 
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" asChild className="mr-4">
          <Link href={booking.status === 'pending' ? "/admin/inbox" : "/admin/bookings"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {booking.status === 'pending' ? 'Back to Inbox' : 'Back to Bookings'}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Booking Details: <span className="font-mono text-xl text-muted-foreground">{booking.id}</span></h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl">Booking Summary</CardTitle>
              <div className="flex gap-2">
                {booking.status && 
                  <Badge className={getStatusBadgeVariant(booking.status)}>
                    Status: {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </Badge>
                }
                {booking.payment_status && 
                  <Badge className={getStatusBadgeVariant(booking.payment_status)}>
                    Payment: {booking.payment_status.charAt(0).toUpperCase() + booking.payment_status.slice(1)}
                  </Badge>
                }
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="relative w-full md:w-48 h-32 rounded-md overflow-hidden bg-muted">
                  <Image
                    src={booking.car?.car_images?.[0]?.url || booking.car?.image || "/placeholder.svg?text=No+Car+Image"}
                    alt={booking.car?.name || "Car Image"}
                    fill
                    className="object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg?text=Error'; }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{booking.car?.name || "N/A"}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-start gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Rental Period</p>
                        <p className="text-sm">
                          {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {totalDays} day{totalDays !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CreditCard className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Payment</p>
                        <p className="text-sm">${(booking.total_price / totalDays).toFixed(2)}/day (approx)</p> 
                        <p className="text-sm font-bold">Total: ${booking.total_price?.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Customer</p>
                        <p className="text-sm">{booking.customer?.first_name} {booking.customer?.last_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.customer?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Booking ID</p>
                        <p className="text-sm font-mono">{booking.id}</p>
                        <p className="text-sm text-muted-foreground">Created: {formatDateTime(booking.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {booking.notes && (
                <div className="mt-6 p-4 bg-muted rounded-md">
                  <p className="text-sm font-medium">Notes from Customer</p>
                  <p className="text-sm">{booking.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <InfoItem icon={<User />} label="Full Name" value={`${booking.customer?.first_name || "N/A"} ${booking.customer?.last_name || ""}`} />
                  <InfoItem icon={<Mail />} label="Email" value={booking.customer?.email || "N/A"} />
                  <InfoItem icon={<Phone />} label="Phone" value={booking.customer?.phone || "N/A"} />
                </div>
                <div className="space-y-4">
                  <InfoItem icon={<MapPin />} label="Address" value={"N/A (not fetched)"} /> 
                  <InfoItem icon={<FileText />} label="Driver's License" value={"N/A (not fetched)"} />
                  <InfoItem icon={<Check />} label="Verification Status" value={<Badge className={getStatusBadgeVariant("N/A")}>N/A</Badge>} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Payment Method</p>
                    <p>N/A (Details from payments table not fetched)</p>
                  </div>
                  {booking.payment_status && 
                    <Badge className={getStatusBadgeVariant(booking.payment_status)}>
                      {booking.payment_status.charAt(0).toUpperCase() + booking.payment_status.slice(1)}
                    </Badge>
                  }
                </div>
                <Separator />
                <InfoItem label="Total Amount" value={`$${booking.total_price?.toLocaleString()}`} isBold={true} />
                <InfoItem label="Currency" value={booking.currency || "USD"} />
                <div className="mt-4 p-4 bg-muted rounded-md">
                  <p className="text-sm font-medium">Payment Status Note</p>
                  <p className="text-sm">
                    Current status is {booking.payment_status}. Further payment actions might be available depending on status.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contract Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Contract Status</p>
                    <p>
                      {booking.contract_status === "signed"
                        ? `Signed on ${formatDateTime(booking.signed_at)}`
                        : "Pending signature"}
                    </p>
                  </div>
                  <Badge className={getStatusBadgeVariant(booking.contract_status)}>
                    {booking.contract_status.charAt(0).toUpperCase() + booking.contract_status.slice(1)}
                  </Badge>
                </div>
                {booking.contract_status === "signed" && (
                  <Button variant="outline" asChild className="w-full">
                    <Link href={booking.contract_document_url} target="_blank">
                      View Signed Contract
                    </Link>
                  </Button>
                )}
                {booking.contract_status === "pending" && <Button className="w-full">Send Contract Reminder</Button>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <BookingActionButtons booking={booking} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking History</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <InfoItem icon={<History />} label="Created At" value={formatDateTime(booking.created_at)} />
              <InfoItem icon={<History />} label="Last Updated" value={formatDateTime(booking.updated_at)} />
              <p className="mt-4 text-sm text-muted-foreground">Detailed event timeline not yet implemented.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Helper component for consistent info display
const InfoItem = ({ icon, label, value, isBold }: { icon?: React.ReactNode, label: string, value: React.ReactNode, isBold?: boolean }) => (
  <div className="flex items-start gap-3">
    {icon && <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>}
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-sm ${isBold ? 'font-bold' : ''}`}>{value}</p>
    </div>
  </div>
)

