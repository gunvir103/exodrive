"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search, Loader2 } from "lucide-react"

// Force dynamic rendering for this admin page
export const dynamic = 'force-dynamic'

interface Booking {
  id: string
  customer: {
    id: string
    fullName: string
    email: string
    phone?: string
  } | null
  car: {
    id: string
    name: string
    slug: string
    model: string
    pricePerDay: number
    mainImageUrl?: string
  } | null
  startDate: string
  endDate: string
  totalPrice: number
  currency: string
  overallStatus: string
  paymentStatus: string
  contractStatus: string
  createdAt: string
  bookingDays: number
}

interface BookingsResponse {
  bookings: Booking[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<BookingsResponse['pagination'] | null>(null)

  const fetchBookings = async (status: string = 'all', search: string = '', page: number = 1) => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        status: status,
        page: page.toString(),
        limit: '20',
        sortBy: 'created_at',
        sortOrder: 'desc'
      })
      
      if (search) {
        params.append('search', search)
      }

      const response = await fetch(`/api/admin/bookings?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(`Failed to fetch bookings: ${errorData.error || response.statusText}`)
      }
      
      const data = await response.json()
      
      // Check if response has the expected structure
      if (!data.bookings || !Array.isArray(data.bookings)) {
        console.error('Invalid response structure:', data)
        throw new Error('Invalid response format from API')
      }
      
      setBookings(data.bookings)
      setPagination(data.pagination)
    } catch (err) {
      console.error('Error fetching bookings:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookings()
  }, [])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
    fetchBookings('all', value, 1)
  }

  const handleTabChange = (status: string) => {
    setCurrentPage(1)
    fetchBookings(status, searchTerm, 1)
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Manage Bookings</h1>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <Button onClick={() => fetchBookings()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Bookings</h1>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search bookings..." 
            className="w-full pl-8"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All Bookings</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading bookings...</span>
          </div>
        ) : (
          <>
            <TabsContent value="all" className="mt-6">
              <BookingsList bookings={bookings} />
            </TabsContent>
            <TabsContent value="active" className="mt-6">
              <BookingsList bookings={bookings} />
            </TabsContent>
            <TabsContent value="upcoming" className="mt-6">
              <BookingsList bookings={bookings} />
            </TabsContent>
            <TabsContent value="completed" className="mt-6">
              <BookingsList bookings={bookings} />
            </TabsContent>
            
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-6">
                <p className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} bookings
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => {
                      const newPage = pagination.page - 1
                      setCurrentPage(newPage)
                      fetchBookings('all', searchTerm, newPage)
                    }}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => {
                      const newPage = pagination.page + 1
                      setCurrentPage(newPage)
                      fetchBookings('all', searchTerm, newPage)
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  )
}

function BookingsList({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No bookings found</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
    </div>
  )
}

function BookingCard({ booking }: { booking: Booking }) {
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
      case "paid":
        return "bg-green-100 text-green-800"
      case "pending":
      case "pending_payment":
      case "pending_contract":
        return "bg-orange-100 text-orange-800"
      case "signed":
      case "not_sent":
      case "sent":
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
            <Image 
              src={booking.car?.mainImageUrl || "/placeholder.svg"} 
              alt={booking.car?.name || 'Car'} 
              fill 
              className="object-cover" 
            />
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold">{booking.car?.name || 'Unknown Car'}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <div>
                <p className="text-sm font-medium">Customer</p>
                <p className="font-medium">{booking.customer?.fullName || 'Unknown Customer'}</p>
                <p className="text-sm text-muted-foreground">{booking.customer?.email}</p>
                {booking.customer?.phone && (
                  <p className="text-sm text-muted-foreground">{booking.customer.phone}</p>
                )}
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
              {booking.overallStatus === "active" && (
                <Button variant="outline" size="sm">
                  Mark as Completed
                </Button>
              )}
              {booking.overallStatus === "upcoming" && booking.contractStatus === "not_sent" && (
                <Button variant="outline" size="sm">
                  Send Contract Reminder
                </Button>
              )}
              {booking.overallStatus === "completed" && booking.paymentStatus === "authorized" && (
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