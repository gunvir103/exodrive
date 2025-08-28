import type { Metadata } from "next"
import ContactClient from "./contact-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Contact ExoDrive - Exotic Car Rental in Rockville, MD | DC, MD, VA Service",
    description: "Contact ExoDrive for exotic car rentals in DC, MD, VA. Located in Rockville, MD. Call (301) 300-4609 or email exodrivexotics@gmail.com for bookings and questions.",
    keywords: [
      "contact ExoDrive",
      "exotic car rental contact",
      "luxury car rental Rockville MD",
      "DMV exotic car rental",
      "Washington DC car rental",
      "Maryland Virginia car rental",
      "Seven Locks Road Rockville",
      "exotic car rental phone number",
      "luxury car rental email",
      "car rental requirements",
      "driver license age 25",
      "car rental insurance",
      "payment process",
      "security deposit",
      "delivery service DMV",
      "pickup service",
      "rental cancellation policy",
      "72 hours cancellation",
      "business hours",
      "appointment booking",
      "rental FAQ",
      "driving record",
      "credit card authorization",
      "full coverage insurance",
      "exotic car rental questions"
    ],
    openGraph: {
      title: "Contact ExoDrive - Exotic Car Rental in Rockville, MD",
      description: "Get in touch with ExoDrive for premium exotic car rentals. Located in Rockville, MD serving DC, MD, VA. Call (301) 300-4609 for bookings and questions.",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary",
      title: "Contact ExoDrive - Exotic Car Rental in Rockville, MD",
      description: "Contact ExoDrive for exotic car rentals in DC, MD, VA. Located in Rockville, MD. Call (301) 300-4609 for bookings.",
    },
    alternates: {
      canonical: "/contact",
    },
    other: {
      "geo.region": "US-MD",
      "geo.placename": "Rockville",
      "geo.position": "39.0840;-77.1528",
      "ICBM": "39.0840, -77.1528",
    },
  }
}

export default function ContactPage() {
  return <ContactClient />
}

