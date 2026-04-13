'use client'

import { useEffect, useState } from 'react'

interface CountdownOverlayProps {
  readonly onComplete: () => void
}

/**
 * Full-screen countdown overlay: 3 → 2 → 1 → SNAP!
 * Each number pulses and fades, then fires onComplete.
 */
export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (count <= 0) {
      onComplete()
      return
    }

    const timer = setTimeout(() => {
      setCount((prev) => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [count, onComplete])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div key={count} className="countdown-number text-white drop-shadow-lg">
        {count > 0 ? count : 'SNAP!'}
      </div>
    </div>
  )
}

export default CountdownOverlay
