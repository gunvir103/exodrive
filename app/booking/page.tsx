import { Metadata } from 'next'
import { BookingClient } from './components/booking-client'

export const metadata: Metadata = {
  title: 'Book Your Car | Exo Drive',
  description: 'Complete your luxury car rental booking. Secure, fast, and easy.',
  robots: {
    index: false, // Don't index booking pages
  },
}

export default function BookingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-4">Complete Your Booking</h1>
            <p className="text-lg text-muted-foreground">
              You're just a few steps away from your luxury car experience
            </p>
          </div>
          
          <BookingClient />
        </div>
      </div>
    </div>
  )
}