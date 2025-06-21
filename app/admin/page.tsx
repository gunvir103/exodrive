"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Car, Users, DollarSign, Calendar, TrendingUp, ArrowUpRight, ArrowDownRight, ImageIcon, Home, Loader2 } from "lucide-react"

interface Stat {
  title: string
  value: string
  change: string
  trend: "up" | "down"
  description: string
  icon: string
}

interface RecentBooking {
  id: string
  customer: string
  car: string
  startDate: string
  endDate: string
  status: string
  total: string
}

interface PopularCar {
  id: string
  name: string
  bookings: number
  revenue: string
  availability: string
}

interface AnalyticsData {
  stats: Stat[]
  recentBookings: RecentBooking[]
  popularCars: PopularCar[]
}

export default function AdminPage() {
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setAnalyticsLoading(true)
        setAnalyticsError(null)

        const response = await fetch('/api/admin/analytics')
        
        if (!response.ok) {
          throw new Error(`Failed to fetch analytics: ${response.statusText}`)
        }
        
        const data: AnalyticsData = await response.json()
        setAnalyticsData(data)
      } catch (err) {
        console.error('Error fetching analytics:', err)
        setAnalyticsError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      } finally {
        setAnalyticsLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  const getIconComponent = (iconName: string) => {
    const icons = {
      DollarSign,
      Calendar,
      Car,
      Users
    } as const
    return icons[iconName as keyof typeof icons] || DollarSign
  }

  const QuickActions = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Essential Admin Functions</CardTitle>
          <CardDescription>Core admin controls - always available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button asChild>
              <Link href="/admin/cars/new">
                <Car className="mr-2 h-4 w-4" />
                Add New Car
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/bookings">
                <Calendar className="mr-2 h-4 w-4" />
                View Bookings
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/cars">
                <Car className="mr-2 h-4 w-4" />
                Manage Cars
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/hero-settings">
                <ImageIcon className="mr-2 h-4 w-4" />
                Hero Settings
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/homepage-settings">
                <Home className="mr-2 h-4 w-4" />
                Homepage Settings
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/" target="_blank">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Website
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  const AnalyticsSection = () => {
    if (analyticsError) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-600">Analytics Unavailable</CardTitle>
              <CardDescription>Analytics data couldn't be loaded, but all admin functions above remain fully operational</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-red-600 mb-4">Error: {analyticsError}</p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="border-red-200 text-red-600 hover:bg-red-100"
              >
                Retry Analytics
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )
    }

    if (analyticsLoading) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="space-y-6"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-24"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-20 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-32"></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-40"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-40"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-8 bg-muted rounded"></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )
    }

    if (!analyticsData) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>No analytics data available at this time</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics will appear here when data becomes available</p>
            </CardContent>
          </Card>
        </motion.div>
      )
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="space-y-6"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {analyticsData.stats.map((stat, i) => {
            const IconComponent = getIconComponent(stat.icon)
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + (i * 0.1) }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground flex items-center mt-1">
                      {stat.trend === "up" ? (
                        <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                      )}
                      <span className={stat.trend === "up" ? "text-green-500" : "text-red-500"}>{stat.change}</span>{" "}
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.8 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Recent Bookings</CardTitle>
                <CardDescription>Latest bookings across your fleet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.recentBookings.length > 0 ? (
                    <>
                      {analyticsData.recentBookings.map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between border-b pb-4">
                          <div>
                            <div className="font-medium">{booking.car}</div>
                            <div className="text-sm text-muted-foreground">{booking.customer}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(booking.startDate).toLocaleDateString()} -{" "}
                              {new Date(booking.endDate).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{booking.total}</div>
                            <div
                              className={`text-xs ${
                                booking.status === "active"
                                  ? "text-green-500"
                                  : booking.status === "upcoming"
                                    ? "text-blue-500"
                                    : "text-gray-500"
                              }`}
                            >
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">No recent bookings</p>
                    </div>
                  )}
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/admin/bookings">View All Bookings</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.9 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Popular Cars</CardTitle>
                <CardDescription>Your most booked vehicles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.popularCars.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground">
                        <div>Car</div>
                        <div className="text-center">Bookings</div>
                        <div className="text-right">Revenue</div>
                      </div>
                      {analyticsData.popularCars.map((car) => (
                        <div key={car.id} className="grid grid-cols-3 items-center">
                          <div>
                            <div className="font-medium">{car.name}</div>
                            <div
                              className={`text-xs ${car.availability === "Available" ? "text-green-500" : "text-red-500"}`}
                            >
                              {car.availability}
                            </div>
                          </div>
                          <div className="text-center font-medium">{car.bookings}</div>
                          <div className="text-right font-medium">{car.revenue}</div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">No booking data available</p>
                    </div>
                  )}
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/admin/cars">Manage Cars</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Essential admin functions are always available below</p>
        </div>
        <Button variant="outline">
          <Calendar className="mr-2 h-4 w-4" />
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Button>
      </div>

      <QuickActions />
      <AnalyticsSection />
    </div>
  )
}