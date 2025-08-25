"use client"

import { motion } from "framer-motion"
import { CheckCircle } from "lucide-react"
import type { CarFeature } from "@/lib/types/car"

interface CarFeaturesProps {
  features: CarFeature[]
}

export function CarFeatures({ features }: CarFeaturesProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold">Features & Equipment</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.length > 0 ? (
          features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-start gap-2"
            >
              <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">{feature.name}</span>
                {feature.description && <p className="text-sm text-muted-foreground">{feature.description}</p>}
              </div>
            </motion.div>
          ))
        ) : (
          <p className="text-muted-foreground col-span-2 text-center py-4">
            No features have been added for this car yet.
          </p>
        )}
      </div>
    </motion.div>
  )
}

