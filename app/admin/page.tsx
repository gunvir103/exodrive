"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Car, Users, DollarSign, Calendar, TrendingUp, ArrowUpRight, ArrowDownRight, ImageIcon, Home } from "lucide-react"

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const stats = [
    {
      title: "Total Revenue",
      value: "$24,560",
      change: "+12.5%",
      trend: "up",
      description: "vs. previous month",
      icon: DollarSign,
    },
    {
      title: "Active Bookings",
      value: "8",
      change: "+3",
      trend: "up",
      description: "vs. previous month",
      icon: Calendar,
    },
    {
      title: "Available Cars",
      value: "15",
      change: "-2",
      trend: "down",
      description: "vs. previous month",
      icon: Car,
    },
    {
      title: "Total Customers",
      value: "142",
      change: "+18",
      trend: "up",
      description: "vs. previous month",
      icon: Users,
    },
  ]

  const recentBookings = [
    {
      id: "B-1234",
      customer: "John Smith",
      car: "Lamborghini Huracán",
      startDate: "2024-03-15",
      endDate: "2024-03-17",
      status: "active",
      total: "$2,400",
    },
    {
      id: "B-1233",
      customer: "Sarah Johnson",
      car: "Ferrari 488",
      startDate: "2024-03-12",
      endDate: "2024-03-14",
      status: "completed",
      total: "$2,800",
    },
    {
      id: "B-1232",
      customer: "Michael Brown",
      car: "Porsche 911 Turbo",
      startDate: "2024-03-18",
      endDate: "2024-03-20",
      status: "upcoming",
      total: "$1,800",
    },
  ]

  const popularCars = [
    {
      id: "lamborghini-huracan",
      name: "Lamborghini Huracán",
      bookings: 12,
      revenue: "$14,400",
      availability: "Available",
    },
    {
      id: "ferrari-488",
      name: "Ferrari 488",
      bookings: 10,
      revenue: "$14,000",
      availability: "Available",
    },
    {
      id: "mclaren-720s",
      name: "McLaren 720S",
      bookings: 8,
      revenue: "$10,400",
      availability: "Booked",
    },
    {
      id: "bentley-continental-gt",
      name: "Bentley Continental GT",
      bookings: 6,
      revenue: "$6,600",
      availability: "Available",
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <Button>
          <Calendar className="mr-2 h-4 w-4" />
          March 2024
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
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
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Latest bookings across your fleet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentBookings.map((booking) => (
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
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Popular Cars</CardTitle>
              <CardDescription>Your most booked vehicles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground">
                  <div>Car</div>
                  <div className="text-center">Bookings</div>
                  <div className="text-right">Revenue</div>
                </div>
                {popularCars.map((car) => (
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
                <Button variant="outline" asChild className="w-full">
                  <Link href="/admin/cars">Manage Cars</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
    </div>
  )
}

