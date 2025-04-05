import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Award, Car, CheckCircle, MapPin, Shield, Star, Users } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="container py-10">
      <section className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl font-bold mb-4">About exoDrive</h1>
            <p className="text-lg text-muted-foreground mb-6">
              Bringing luxury and exotic car experiences to the DMV area since 2018.
            </p>
            <p className="mb-4">
              At exoDrive, we believe that everyone deserves to experience the thrill and luxury of driving an exotic
              car. Our mission is to make these extraordinary vehicles accessible to enthusiasts and those seeking a
              special experience in the Washington DC, Maryland, and Virginia area.
            </p>
            <p className="mb-6">
              Founded by a team of automotive enthusiasts, exoDrive has grown from a small collection of luxury vehicles
              to one of the premier exotic car rental services in the DMV area. We take pride in our meticulously
              maintained fleet, exceptional customer service, and our commitment to creating unforgettable driving
              experiences.
            </p>
            <Button asChild>
              <Link href="/fleet">Explore Our Fleet</Link>
            </Button>
          </div>
          <div className="relative h-[400px] rounded-lg overflow-hidden">
            <Image
              src="/placeholder.svg?height=800&width=600&text=About+Us"
              alt="About exoDrive"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mb-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-4">Why Choose exoDrive</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We're committed to providing an exceptional experience from start to finish.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Car,
              title: "Premium Fleet",
              description:
                "Our collection features the latest models from top luxury and exotic car manufacturers, meticulously maintained to ensure peak performance.",
            },
            {
              icon: Shield,
              title: "Seamless Experience",
              description:
                "From booking to return, we've streamlined the process to make your exotic car rental experience as smooth and enjoyable as possible.",
            },
            {
              icon: CheckCircle,
              title: "Personalized Service",
              description:
                "Our team of automotive enthusiasts is dedicated to providing personalized service tailored to your specific needs and preferences.",
            },
          ].map((feature, i) => (
            <Card key={i}>
              <CardContent className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="relative h-[400px] rounded-lg overflow-hidden order-2 md:order-1">
            <Image
              src="/placeholder.svg?height=800&width=600&text=Our+Story"
              alt="Our Story"
              fill
              className="object-cover"
            />
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-3xl font-bold mb-4">Our Story</h2>
            <p className="mb-4">
              exoDrive was founded in 2018 by a group of friends who shared a passion for exotic cars and a vision to
              make these extraordinary vehicles more accessible to enthusiasts in the DMV area.
            </p>
            <p className="mb-4">
              What began with just three vehicles has now grown into a diverse fleet of over 20 luxury and exotic cars,
              carefully curated to offer a range of driving experiences from elegant grand tourers to adrenaline-pumping
              supercars.
            </p>
            <p className="mb-4">
              Our team combines decades of experience in the automotive and hospitality industries, ensuring that every
              aspect of your rental experience meets the highest standards of quality and service.
            </p>
            <p>
              Today, exoDrive is proud to be the premier choice for exotic car rentals in Washington DC, Maryland, and
              Virginia, serving both local enthusiasts and visitors looking to make their time in the DMV area truly
              memorable.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-16 bg-muted/50 py-16 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-4">Our Team</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Meet the automotive enthusiasts behind exoDrive.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              name: "Alex Reynolds",
              role: "Founder & CEO",
              bio: "Former race car driver with a passion for exotic cars and exceptional customer experiences.",
              image: "/placeholder.svg?height=400&width=400&text=AR",
            },
            {
              name: "Sophia Chen",
              role: "Fleet Manager",
              bio: "Automotive engineer ensuring our vehicles are maintained to the highest standards.",
              image: "/placeholder.svg?height=400&width=400&text=SC",
            },
            {
              name: "Marcus Johnson",
              role: "Customer Experience",
              bio: "Luxury hospitality veteran dedicated to creating memorable rental experiences.",
              image: "/placeholder.svg?height=400&width=400&text=MJ",
            },
            {
              name: "Olivia Williams",
              role: "Operations Director",
              bio: "Logistics expert who keeps everything running smoothly behind the scenes.",
              image: "/placeholder.svg?height=400&width=400&text=OW",
            },
          ].map((member, i) => (
            <div key={i} className="text-center">
              <div className="relative w-48 h-48 mx-auto mb-4 rounded-full overflow-hidden">
                <Image src={member.image || "/placeholder.svg"} alt={member.name} fill className="object-cover" />
              </div>
              <h3 className="text-xl font-bold">{member.name}</h3>
              <p className="text-primary font-medium mb-2">{member.role}</p>
              <p className="text-muted-foreground">{member.bio}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-4">Our Achievements</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Recognition of our commitment to excellence.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Award,
              title: "Best Luxury Rental Service",
              year: "2023",
              org: "DC Luxury Lifestyle Awards",
            },
            {
              icon: Star,
              title: "Customer Satisfaction Excellence",
              year: "2022",
              org: "National Rental Association",
            },
            {
              icon: Users,
              title: "Community Impact Award",
              year: "2022",
              org: "DMV Business Council",
            },
            {
              icon: Shield,
              title: "Safety & Reliability Award",
              year: "2021",
              org: "Luxury Transport Guild",
            },
          ].map((achievement, i) => (
            <Card key={i}>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <achievement.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-bold mb-1">{achievement.title}</h3>
                <p className="text-muted-foreground">
                  {achievement.year} - {achievement.org}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-4">Our Location</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Conveniently located in the heart of Washington DC.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="flex items-start gap-3 mb-4">
              <MapPin className="h-5 w-5 text-primary shrink-0 mt-1" />
              <div>
                <h3 className="font-bold mb-1">Main Office & Showroom</h3>
                <p className="text-muted-foreground">
                  1201 Seven Locks Rd, Suite 360
                  <br />
                  Rockville, MD 20854
                  <br />
                  United States
                </p>
              </div>
            </div>
            <div className="mb-6">
              <h3 className="font-bold mb-2">Hours of Operation</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="font-medium">Monday - Friday</p>
                  <p className="text-muted-foreground">9:00 AM - 7:00 PM</p>
                </div>
                <div>
                  <p className="font-medium">Saturday</p>
                  <p className="text-muted-foreground">10:00 AM - 5:00 PM</p>
                </div>
                <div>
                  <p className="font-medium">Sunday</p>
                  <p className="text-muted-foreground">By appointment only</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <p>
                Our showroom is easily accessible from all major highways and just a 15-minute drive from Reagan
                National Airport.
              </p>
              <p>We also offer delivery and pickup services throughout the DMV area for an additional fee.</p>
              <Button asChild>
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
          <div className="relative h-[400px] rounded-lg overflow-hidden">
            <Image
              src="/placeholder.svg?height=800&width=600&text=Location+Map"
              alt="exoDrive Location"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section>
        <div className="text-center py-16 bg-primary text-primary-foreground rounded-lg">
          <h2 className="text-3xl font-bold mb-4">Ready to Experience Luxury?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Browse our collection of exotic cars and book your unforgettable driving experience today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/fleet">Browse Our Fleet</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-primary-foreground/10" asChild>
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

