"use client"

import { motion } from "framer-motion"

interface TextAnimationOptions {
  delayOffset?: number
  wordSpacing?: string
  highlightClass?: string
  characterAnimationConfig?: {
    initialY?: number
    initialYRandomRange?: number
    duration?: number
    stiffness?: number
    damping?: number
  }
}

export const useTextAnimation = (options: TextAnimationOptions = {}) => {
  const {
    delayOffset = 0.5,
    wordSpacing = "0.25em",
    highlightClass = "text-gradient gradient-secondary",
    characterAnimationConfig = {
      initialY: 0,
      initialYRandomRange: 5,
      duration: 0.3,
      stiffness: 120,
      damping: 15,
    },
  } = options

  const animateText = (text: string) => {
    if (!text) return null

    // Split the text into words
    const words = text.split(" ")

    return (
      <span className="inline-block">
        {words.map((word, i) => {
          // Check if the word contains highlight markers
          if (word.includes("*")) {
            const parts = word.split("*")
            return (
              <span key={i} className="inline-block" style={{ marginRight: wordSpacing }}>
                {parts.map((part, j) => {
                  // Every other part (odd indices) should be highlighted
                  if (j % 2 === 1) {
                    return (
                      <motion.span
                        key={j}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.5,
                          delay: 0.1 * i + delayOffset,
                          type: "spring",
                          stiffness: 100,
                        }}
                        className={`inline-block ${highlightClass}`}
                      >
                        {/* Animate the whole highlighted word as one unit */}
                        {part}
                      </motion.span>
                    )
                  }

                  // Regular text within a highlighted word
                  if (part.length === 0) return null

                  return (
                    <motion.span
                      key={j}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        delay: 0.1 * i + delayOffset,
                      }}
                      className="inline-block"
                    >
                      {part.split("").map((char, k) => (
                        <motion.span
                          key={k}
                          initial={{
                            opacity: 0,
                            y:
                              Math.random() * characterAnimationConfig.initialYRandomRange -
                              characterAnimationConfig.initialYRandomRange / 2 +
                              characterAnimationConfig.initialY,
                          }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: characterAnimationConfig.duration,
                            delay: 0.1 * i + delayOffset + k * 0.03,
                            type: "spring",
                            stiffness: characterAnimationConfig.stiffness,
                            damping: characterAnimationConfig.damping,
                          }}
                          className="inline-block"
                        >
                          {char}
                        </motion.span>
                      ))}
                    </motion.span>
                  )
                })}
              </span>
            )
          }

          // Regular word without highlighting
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i + delayOffset }}
              className="inline-block"
              style={{ marginRight: wordSpacing }}
            >
              {word.split("").map((char, k) => (
                <motion.span
                  key={k}
                  initial={{
                    opacity: 0,
                    y:
                      Math.random() * characterAnimationConfig.initialYRandomRange -
                      characterAnimationConfig.initialYRandomRange / 2 +
                      characterAnimationConfig.initialY,
                  }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: characterAnimationConfig.duration,
                    delay: 0.1 * i + delayOffset + k * 0.02,
                    type: "spring",
                    stiffness: characterAnimationConfig.stiffness,
                    damping: characterAnimationConfig.damping,
                  }}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              ))}
            </motion.span>
          )
        })}
      </span>
    )
  }

  return { animateText }
}

