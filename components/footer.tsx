import type React from "react"
import Link from "next/link"
import { Instagram } from "lucide-react"

// Custom TikTok icon component
function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="bg-background border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4">ExoDrive</h3>
            <p className="text-muted-foreground">
              Experience luxury and performance with our premium car rental service.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/fleet" className="text-muted-foreground hover:text-foreground transition-colors">
                  Our Fleet
                </Link>
              </li>
              <li>
                <Link href="/policies" className="text-muted-foreground hover:text-foreground transition-colors">
                  Policies
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <address className="not-italic text-muted-foreground">
              <p>1201 Seven Locks Rd, Suite 360</p>
              <p>Rockville, MD 20854</p>
              <p className="mt-2">
                Phone:{" "}
                <a href="sms:+13013004609" className="hover:underline">
                  +1 (301) 300-4609
                </a>
              </p>
              <p>
                Email:{" "}
                <a href="mailto:exodrivexotics@gmail.com" className="hover:underline">
                  exodrivexotics@gmail.com
                </a>
              </p>
            </address>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Follow Us</h4>
            <div className="flex space-x-4">
              <a href="https://www.instagram.com/exodriveexotics/" className="text-muted-foreground hover:text-foreground transition-colors">
                <Instagram className="h-5 w-5" />
                <span className="sr-only">Instagram</span>
              </a>
              <a href="https://tiktok.com/@exodriveer" className="text-muted-foreground hover:text-foreground transition-colors">
                <TikTokIcon className="h-5 w-5" />
                <span className="sr-only">TikTok</span>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ExoDrive. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0">
            <Link href="/admin/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

