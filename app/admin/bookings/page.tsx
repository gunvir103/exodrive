import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

// Force dynamic rendering for this admin page
export const dynamic = 'force-dynamic'
export const revalidate = 0

// This would normally come from Supabase
const bookings = [
  {
    id: "booking-1",
    customer: {
      name: "John Smith",
      email: "john.smith@example.com",
      phone: "(202) 555-0123",
    },
    car: {
      id: "lamborghini-huracan",
      name: "Lamborghini Huracán",
      image: "/placeholder.svg?height=400&width=600&text=Lamborghini",
    },
    startDate: "2024-03-15",
    endDate: "2024-03-17",
    totalPrice: 2400,
    status: "active",
    paymentStatus: "authorized",
    contractStatus: "signed",
  },
  {
    id: "booking-2",
    customer: {
      name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      phone: "(202) 555-0124",
    },
    car: {
      id: "ferrari-488",
      name: "Ferrari 488",
      image: "/placeholder.svg?height=400&width=600&text=Ferrari",
    },
    startDate: "2024-03-12",
    endDate: "2024-03-14",
    totalPrice: 2800,
    status: "completed",
    paymentStatus: "captured",
    contractStatus: "signed",
  },
  {
    id: "booking-3",
    customer: {
      name: "Michael Brown",
      email: "michael.brown@example.com",
      phone: "(202) 555-0125",
    },
    car: {
      id: "porsche-911-turbo",
      name: "Porsche 911 Turbo",
      image: "/placeholder.svg?height=400&width=600&text=Porsche",
    },
    startDate: "2024-03-18",
    endDate: "2024-03-20",
    totalPrice: 1800,
    status: "upcoming",
    paymentStatus: "authorized",
    contractStatus: "pending",
  },
  {
    id: "booking-4",
    customer: {
      name: "Emily Davis",
      email: "emily.davis@example.com",
      phone: "(202) 555-0126",
    },
    car: {
      id: "aston-martin-vantage",
      name: "Aston Martin Vantage",
      image: "/placeholder.svg?height=400&width=600&text=Aston+Martin",
    },
    startDate: "2024-03-10",
    endDate: "2024-03-12",
    totalPrice: 1900,
    status: "completed",
    paymentStatus: "captured",
    contractStatus: "signed",
  },
]

export default function AdminBookingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Bookings</h1>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search bookings..." className="w-full pl-8" />
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Bookings</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-6">
          <div className="grid gap-6">
            {bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="active" className="mt-6">
          <div className="grid gap-6">
            {bookings
              .filter((booking) => booking.status === "active")
              .map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
          </div>
        </TabsContent>
        <TabsContent value="upcoming" className="mt-6">
          <div className="grid gap-6">
            {bookings
              .filter((booking) => booking.status === "upcoming")
              .map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
          </div>
        </TabsContent>
        <TabsContent value="completed" className="mt-6">
          <div className="grid gap-6">
            {bookings
              .filter((booking) => booking.status === "completed")
              .map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BookingCard({ booking }: { booking: any }) {
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
    return new Date(dateString).toLocaleDateString("en-US", options)
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
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative w-full md:w-48 h-32 rounded-md overflow-hidden">
            <Image src={booking.car.image || "/placeholder.svg"} alt={booking.car.name} fill className="object-cover" />
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold">{booking.car.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <div>
                <p className="text-sm font-medium">Customer</p>
                <p className="font-medium">{booking.customer.name}</p>
                <p className="text-sm text-muted-foreground">{booking.customer.email}</p>
                <p className="text-sm text-muted-foreground">{booking.customer.phone}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Booking ID</p>
                <p className="font-mono text-sm">{booking.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Total</p>
                <p className="font-medium">${booking.totalPrice}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm">
                <Link href={`/admin/bookings/${booking.id}`}>View Details</Link>
              </Button>
              {booking.status === "active" && (
                <Button variant="outline" size="sm">
                  Mark as Completed
                </Button>
              )}
              {booking.status === "upcoming" && booking.contractStatus === "pending" && (
                <Button variant="outline" size="sm">
                  Send Contract Reminder
                </Button>
              )}
              {booking.status === "completed" && booking.paymentStatus === "authorized" && (
                <Button variant="outline" size="sm">
                  Capture Payment
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

