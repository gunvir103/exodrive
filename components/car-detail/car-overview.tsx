"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Gauge, Clock, Star, ShieldCheck } from "lucide-react"
import type { AppCar, CarSpecification } from "@/lib/services/car-service-supabase"

interface CarOverviewProps {
  car: AppCar
}

export function CarOverview({ car }: CarOverviewProps) {
  // Get highlighted specs for the overview section
  const highlightedSpecs = car.specifications.filter((spec) => spec.is_highlighted).slice(0, 4)

  // Map spec names to icons
  const getSpecIcon = (spec: CarSpecification) => {
    const name = spec.name.toLowerCase()
    if (name.includes("engine")) return Gauge
    if (name.includes("power")) return ShieldCheck
    if (name.includes("acceleration") || name.includes("0-60")) return Clock
    if (name.includes("top speed")) return Star
    return Gauge
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold">About this car</h2>
      </div>

      <p className="text-muted-foreground text-lg leading-relaxed">{car.description}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {highlightedSpecs.map((spec) => {
          const Icon = getSpecIcon(spec)
          return (
            <motion.div
              key={spec.id}
              whileHover={{ y: -5 }}
              className="flex flex-col items-center bg-muted p-4 rounded-lg"
            >
              <Icon className="h-6 w-6 mb-2 text-rose-600" />
              <span className="text-sm text-muted-foreground">{spec.name}</span>
              <span className="font-medium text-center">{spec.value}</span>
            </motion.div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={car.available ? "default" : "secondary"} className="capitalize">
          {car.available ? "Available Now" : "Currently Booked"}
        </Badge>
        <Badge>{car.category}</Badge>
        {car.featured && (
          <Badge className="bg-rose-600 hover:bg-rose-700">
            <Star className="mr-1 h-3 w-3" />
            Featured
          </Badge>
        )}
      </div>
    </motion.div>
  )
}

