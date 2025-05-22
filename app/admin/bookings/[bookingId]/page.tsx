import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Calendar, Check, CreditCard, FileText, Mail, Phone, User, MapPin } from "lucide-react"

// This would normally come from Supabase
const bookings = [
  {
    id: "booking-1",
    customer: {
      name: "John Smith",
      email: "john.smith@example.com",
      phone: "(202) 555-0123",
      address: "123 Main St, Washington, DC 20001",
      driverLicense: "DC12345678",
      verificationStatus: "verified",
    },
    car: {
      id: "lamborghini-huracan",
      name: "Lamborghini Huracán",
      image: "/placeholder.svg?height=400&width=600&text=Lamborghini",
    },
    startDate: "2024-03-15",
    endDate: "2024-03-17",
    totalDays: 2,
    dailyRate: 1200,
    totalPrice: 2400,
    status: "active",
    paymentStatus: "authorized",
    contractStatus: "signed",
    paymentDetails: {
      id: "pi_1234567890",
      last4: "4242",
      brand: "Visa",
      authorizedAmount: 2400,
      capturedAmount: 0,
    },
    contractDetails: {
      id: "contract-1234",
      signedAt: "2024-03-14T15:30:00Z",
      documentUrl: "#",
    },
    notes: "Customer requested airport pickup.",
    timeline: [
      {
        date: "2024-03-10T12:45:00Z",
        event: "Booking created",
        details: "Customer submitted booking request",
      },
      {
        date: "2024-03-10T12:46:00Z",
        event: "Payment pre-authorized",
        details: "Pre-authorization hold of $2,400 placed on card ending in 4242",
      },
      {
        date: "2024-03-10T13:15:00Z",
        event: "Identity verified",
        details: "Customer completed Stripe Identity verification",
      },
      {
        date: "2024-03-14T15:30:00Z",
        event: "Contract signed",
        details: "Customer signed rental agreement via Dropbox Sign",
      },
      {
        date: "2024-03-15T10:00:00Z",
        event: "Car picked up",
        details: "Customer picked up the vehicle",
      },
    ],
  },
]

export default function BookingDetailPage({ params }: { params: { bookingId: string } }) {
  const booking = bookings.find((b) => b.id === params.bookingId)

  if (!booking) {
    notFound()
  }

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
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-orange-100 text-orange-800"
      case "signed":
        return "bg-green-100 text-green-800"
      case "verified":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
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
                <Badge className={getStatusColor(booking.status)}>
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </Badge>
                <Badge className={getStatusColor(booking.paymentStatus)}>
                  Payment: {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
                </Badge>
                <Badge className={getStatusColor(booking.contractStatus)}>
                  Contract: {booking.contractStatus.charAt(0).toUpperCase() + booking.contractStatus.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="relative w-full md:w-48 h-32 rounded-md overflow-hidden">
                  <Image
                    src={booking.car.image || "/placeholder.svg"}
                    alt={booking.car.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{booking.car.name}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-start gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Rental Period</p>
                        <p className="text-sm">
                          {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {booking.totalDays} day{booking.totalDays !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CreditCard className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Payment</p>
                        <p className="text-sm">${booking.dailyRate}/day</p>
                        <p className="text-sm font-bold">Total: ${booking.totalPrice}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Customer</p>
                        <p className="text-sm">{booking.customer.name}</p>
                        <p className="text-sm text-muted-foreground">{booking.customer.email}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Booking ID</p>
                        <p className="text-sm font-mono">{booking.id}</p>
                        <p className="text-sm text-muted-foreground">Created on Mar 10, 2024</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {booking.notes && (
                <div className="mt-6 p-4 bg-muted rounded-md">
                  <p className="text-sm font-medium">Notes</p>
                  <p className="text-sm">{booking.notes}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-6">
                {booking.status === "active" && <Button>Mark as Completed</Button>}
                {booking.status === "completed" && booking.paymentStatus === "authorized" && (
                  <Button>Capture Payment</Button>
                )}
                {booking.contractStatus === "pending" && <Button variant="outline">Send Contract Reminder</Button>}
                <Button variant="outline">Edit Booking</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Full Name</p>
                      <p>{booking.customer.name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Mail className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p>{booking.customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p>{booking.customer.phone}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p>{booking.customer.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Driver's License</p>
                      <p>{booking.customer.driverLicense}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Verification Status</p>
                      <Badge className={getStatusColor(booking.customer.verificationStatus)}>
                        {booking.customer.verificationStatus.charAt(0).toUpperCase() +
                          booking.customer.verificationStatus.slice(1)}
                      </Badge>
                    </div>
                  </div>
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
                    <p>
                      {booking.paymentDetails.brand} ending in {booking.paymentDetails.last4}
                    </p>
                  </div>
                  <Badge className={getStatusColor(booking.paymentStatus)}>
                    {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <p className="text-sm">Daily Rate</p>
                    <p className="text-sm">${booking.dailyRate}/day</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm">Duration</p>
                    <p className="text-sm">
                      {booking.totalDays} day{booking.totalDays !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <p>Total Amount</p>
                    <p>${booking.totalPrice}</p>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-muted rounded-md">
                  <p className="text-sm font-medium">Payment Status</p>
                  <p className="text-sm">
                    Pre-authorization hold of ${booking.paymentDetails.authorizedAmount} placed on card.
                    {booking.paymentDetails.capturedAmount > 0
                      ? ` ${booking.paymentDetails.capturedAmount} has been captured.`
                      : " Payment will be captured after rental completion."}
                  </p>
                </div>
                {booking.status === "completed" && booking.paymentStatus === "authorized" && (
                  <Button className="w-full">Capture Payment</Button>
                )}
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
                      {booking.contractStatus === "signed"
                        ? `Signed on ${formatDateTime(booking.contractDetails.signedAt)}`
                        : "Pending signature"}
                    </p>
                  </div>
                  <Badge className={getStatusColor(booking.contractStatus)}>
                    {booking.contractStatus.charAt(0).toUpperCase() + booking.contractStatus.slice(1)}
                  </Badge>
                </div>
                {booking.contractStatus === "signed" && (
                  <Button variant="outline" asChild className="w-full">
                    <Link href={booking.contractDetails.documentUrl} target="_blank">
                      View Signed Contract
                    </Link>
                  </Button>
                )}
                {booking.contractStatus === "pending" && <Button className="w-full">Send Contract Reminder</Button>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Booking Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {booking.timeline.map((event, index) => (
                  <div key={index} className="relative pl-6 pb-6">
                    {index !== booking.timeline.length - 1 && (
                      <div className="absolute top-2 left-2 bottom-0 w-px bg-border" />
                    )}
                    <div className="absolute top-2 left-0 w-4 h-4 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium">{event.event}</p>
                      <p className="text-sm text-muted-foreground">{formatDateTime(event.date)}</p>
                      <p className="text-sm mt-1">{event.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-2">
                <Button className="w-full">Send Email to Customer</Button>
                <Button variant="outline" className="w-full">
                  Print Booking Details
                </Button>
                {booking.status !== "cancelled" && (
                  <Button variant="destructive" className="w-full">
                    Cancel Booking
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

