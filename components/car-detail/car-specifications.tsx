"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import type { CarSpecification } from "@/lib/types/car"

interface CarSpecificationsProps {
  specifications: CarSpecification[]
}

export function CarSpecifications({ specifications }: CarSpecificationsProps) {
  const specsRef = useRef(null)
  const isSpecsInView = useInView(specsRef, { once: true, amount: 0.3 })

  // Split specifications into two columns
  const midpoint = Math.ceil(specifications.length / 2)
  const leftSpecs = specifications.slice(0, midpoint)
  const rightSpecs = specifications.slice(midpoint)

  return (
    <motion.div
      ref={specsRef}
      initial={{ opacity: 0 }}
      animate={isSpecsInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold">Technical Specifications</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {leftSpecs.map((spec, index) => (
            <motion.div
              key={spec.id}
              initial={{ opacity: 0, x: -20 }}
              animate={isSpecsInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex justify-between py-2 border-b"
            >
              <span className="font-medium">{spec.name}</span>
              <span>{spec.value}</span>
            </motion.div>
          ))}
        </div>
        <div className="space-y-4">
          {rightSpecs.map((spec, index) => (
            <motion.div
              key={spec.id}
              initial={{ opacity: 0, x: 20 }}
              animate={isSpecsInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex justify-between py-2 border-b"
            >
              <span className="font-medium">{spec.name}</span>
              <span>{spec.value}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

