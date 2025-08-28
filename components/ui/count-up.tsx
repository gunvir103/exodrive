'use client'

import { useEffect, useState } from "react"

interface CountUpProps {
  target: number;
  duration?: number;
}

export function CountUp({ target, duration = 1.5 }: CountUpProps) {
  const [count, setCount] = useState(0)
  
  useEffect(() => {
    setCount(0)
    const totalFrames = Math.min(duration / 16, 100)
    const increment = target > 0 ? target / totalFrames : 0
    let currentCount = 0
    let frame = 0
    
    const counter = setInterval(() => {
      currentCount = Math.min(currentCount + increment, target)
      setCount(Math.floor(currentCount))
      frame++
      if (frame >= totalFrames) {
        clearInterval(counter)
        setCount(target)
      }
    }, 16)
    
    return () => clearInterval(counter)
  }, [target, duration])
  
  return <>{count}</>
}