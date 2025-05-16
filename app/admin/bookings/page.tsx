import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search, Inbox, AlertTriangle } from "lucide-react"
import { fetchBookings as queryFetchBookings } from "@/lib/queries/bookings"

// Force dynamic rendering for this admin page
export const dynamic = 'force-dynamic'
// export const revalidate = 0; // Can be set if needed, or use time-based revalidation from fetch

// This is now a Server Component that fetches data
export default async function AdminBookingsPage() {
  let bookings: any[] = []
  let fetchError: string | null = null

  try {
    // Directly call the query function instead of fetching from the API route
    const statuses = ["authorized", "active", "completed"]
    const fetchedData = await queryFetchBookings(statuses)
    bookings = fetchedData || [] // Ensure bookings is an array, even if fetchedData is null/undefined
  } catch (error: any) {
    console.error("Failed to fetch bookings for admin page:", error)
    fetchError = error.message || "An unknown error occurred while fetching bookings."
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Bookings</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/admin/inbox" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              View Pending Inbox
            </Link>
          </Button>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search bookings..." className="w-full pl-8" />
          </div>
        </div>
      </div>

      {fetchError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4 flex items-center text-destructive">
            <AlertTriangle className="h-5 w-5 mr-2" /> {fetchError}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Bookings ({bookings.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({bookings.filter((b:any) => b.status === 'active').length})</TabsTrigger>
          <TabsTrigger value="authorized">Authorized ({bookings.filter((b:any) => b.status === 'authorized').length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({bookings.filter((b:any) => b.status === 'completed').length})</TabsTrigger>
        </TabsList>

        {/* Render content based on fetched bookings */}
        <TabsContent value="all" className="mt-6">
          {bookings.length === 0 && !fetchError && <p className="text-center text-muted-foreground py-4">No bookings match the current filters.</p>}
          <div className="grid gap-6">
            {bookings.map((booking: any) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="active" className="mt-6">
          {bookings.filter((b:any) => b.status === 'active').length === 0 && !fetchError && <p className="text-center text-muted-foreground py-4">No active bookings.</p>}
          <div className="grid gap-6">
            {bookings
              .filter((booking: any) => booking.status === "active")
              .map((booking: any) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
          </div>
        </TabsContent>
        <TabsContent value="authorized" className="mt-6">
          {bookings.filter((b:any) => b.status === 'authorized').length === 0 && !fetchError && <p className="text-center text-muted-foreground py-4">No bookings awaiting payment authorization.</p>}
          <div className="grid gap-6">
            {bookings
              .filter((booking: any) => booking.status === "authorized")
              .map((booking: any) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
          </div>
        </TabsContent>
        <TabsContent value="completed" className="mt-6">
          {bookings.filter((b:any) => b.status === 'completed').length === 0 && !fetchError && <p className="text-center text-muted-foreground py-4">No completed bookings.</p>}
          <div className="grid gap-6">
            {bookings
              .filter((booking: any) => booking.status === "completed")
              .map((booking: any) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BookingCard({ booking }: { booking: any }) {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
      return date.toLocaleDateString("en-US", options);
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return "Invalid Date";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800"
      case "upcoming":
        return "bg-blue-100 text-blue-800"
      case "booked":
        return "bg-sky-100 text-sky-800"
      case "completed":
        return "bg-gray-100 text-gray-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "authorized":
        return "bg-yellow-100 text-yellow-800"
      case "pending":
        return "bg-orange-100 text-orange-800"
      case "captured":
        return "bg-green-100 text-green-800"
      case "refunded":
        return "bg-purple-100 text-purple-800"
      case "voided":
        return "bg-gray-300 text-gray-900"
      default:
        return "bg-gray-200 text-gray-700"
    }
  }

  const customerName = `${booking.customer?.first_name || ''} ${booking.customer?.last_name || 'Customer'}`.trim()
  const carName = booking.car?.name || "Unknown Car"
  const carImage = booking.car?.car_images?.[0]?.url || "/placeholder.svg?text=No+Image"

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative w-full md:w-48 h-32 rounded-md overflow-hidden bg-muted">
            <Image 
              src={carImage} 
              alt={carName} 
              fill 
              className="object-cover" 
              onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg?text=Error'; }}
            />
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold">{carName}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {booking.status && (
                    <Badge className={getStatusColor(booking.status)}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </Badge>
                )}
                {booking.payment_status && (
                    <Badge className={getStatusColor(booking.payment_status)}>
                    Payment: {booking.payment_status.charAt(0).toUpperCase() + booking.payment_status.slice(1)}
                    </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <div>
                <p className="text-sm font-medium">Customer</p>
                <p className="font-medium">
                  {customerName}
                </p>
                <p className="text-sm text-muted-foreground">{booking.customer?.email || "N/A"}</p>
                <p className="text-sm text-muted-foreground">{booking.customer?.phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Booking ID</p>
                <p className="font-mono text-sm">{booking.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Total</p>
                <p className="font-medium">${booking.total_price?.toLocaleString() || '0.00'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm">
                <Link href={`/admin/bookings/${booking.id}`}>View Details</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

