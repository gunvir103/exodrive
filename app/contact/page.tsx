"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Clock, Mail, MapPin, Phone, Send, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { LocationMapOSM } from "@/components/location-map-osm"

export default function ContactPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { toast } = useToast()

  const address = "1201 Seven Locks Rd, Suite 360, Rockville, MD 20854"

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    toast({
      title: "Message sent",
      description: "We'll get back to you as soon as possible.",
    })

    setIsLoading(false)
    setIsSuccess(true)

    // Reset form
    const form = e.target as HTMLFormElement
    form.reset()
  }

  return (
    <div className="container py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-center"
      >
        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Have questions about our exotic car rentals? We're here to help.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Get In Touch</h2>
            <p className="mb-6">
              Whether you have questions about our fleet, booking process, or special requests, our team is ready to
              assist you. Fill out the form, and we'll get back to you as soon as possible.
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold">Phone</h3>
                  <p className="text-muted-foreground">+1 (301) 300-4609</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold">Email</h3>
                  <p className="text-muted-foreground">exodrivexotics@gmail.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold">Address</h3>
                  <p className="text-muted-foreground">
                    1201 Seven Locks Rd, Suite 360
                    <br />
                    Rockville, MD 20854
                    <br />
                    United States
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold">Hours</h3>
                  <p className="text-muted-foreground">
                    Monday - Friday: 9:00 AM - 7:00 PM
                    <br />
                    Saturday: 10:00 AM - 5:00 PM
                    <br />
                    Sunday: By appointment only
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Location Map */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-bold mb-4">Our Location</h2>
            <LocationMapOSM address={address} className="shadow-md" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              {isSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-10 text-center"
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Thank you for contacting exoDrive. We've received your message and will get back to you as soon as
                    possible.
                  </p>
                  <Button onClick={() => setIsSuccess(false)}>Send Another Message</Button>
                </motion.div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-4">Send Us a Message</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first-name">First Name</Label>
                        <Input id="first-name" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last-name">Last Name</Label>
                        <Input id="last-name" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" type="tel" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input id="subject" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea id="message" rows={5} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <span className="flex items-center">
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Sending...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Send className="mr-2 h-4 w-4" />
                          Send Message
                        </span>
                      )}
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>

          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                {
                  question: "What do I need to rent a car?",
                  answer:
                    "You'll need a valid driver's license, be at least 25 years old, have a clean driving record, and provide proof of full coverage insurance.",
                },
                {
                  question: "How does the payment process work?",
                  answer:
                    "We require a pre-authorization hold on your credit card for the rental amount plus a security deposit. The rental fee is only captured after the rental period is complete.",
                },
                {
                  question: "Do you offer delivery?",
                  answer:
                    "Yes, we offer delivery and pickup services throughout the DMV area for an additional fee. Please contact us for details.",
                },
                {
                  question: "What happens if I need to cancel my reservation?",
                  answer:
                    "Cancellations made 72 hours or more before the rental date receive a full refund. Cancellations within 72 hours are subject to a cancellation fee.",
                },
              ].map((faq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
                  className="bg-muted/50 p-4 rounded-lg"
                >
                  <h3 className="font-bold mb-2">{faq.question}</h3>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

