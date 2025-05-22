import { NextResponse } from "next/server"
import { getActiveHeroContent } from "@/lib/hero-content"

export async function GET() {
  try {
    // Simulate database delay
    await new Promise((resolve) => setTimeout(resolve, 300))

    const activeHero = getActiveHeroContent()

    return NextResponse.json({
      data: activeHero,
      success: true,
    })
  } catch (error) {
    console.error("Error fetching active hero content:", error)
    return NextResponse.json({ error: "Failed to fetch active hero content", success: false }, { status: 500 })
  }
}

