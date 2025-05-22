"use client"

import { motion } from "framer-motion"
import { Star, CheckCircle } from "lucide-react"
import type { CarReview } from "@/lib/types/car"

interface CarReviewsProps {
  reviews: CarReview[]
}

export function CarReviews({ reviews }: CarReviewsProps) {
  // Filter to only show approved reviews
  const approvedReviews = reviews.filter((review) => review.isApproved)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold">Customer Reviews</h2>
      </div>

      {approvedReviews.length > 0 ? (
        <div className="space-y-6">
          {approvedReviews.map((review, index) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-muted/50 p-4 rounded-lg"
            >
              <div className="flex justify-between mb-2">
                <div className="flex items-center">
                  <h3 className="font-bold">{review.name}</h3>
                  {review.isVerified && (
                    <span className="ml-2 flex items-center text-xs text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">{review.date}</span>
              </div>
              <div className="flex mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-muted"}`}
                  />
                ))}
              </div>
              <p className="text-muted-foreground">{review.comment}</p>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No reviews yet for this car.</p>
          <p className="mt-2">This vehicle has not been reviewed by customers yet.</p>
        </div>
      )}
    </motion.div>
  )
}

