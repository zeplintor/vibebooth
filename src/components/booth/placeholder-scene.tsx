'use client'

/**
 * Placeholder scene for empty photo frames — a simple landscape
 * with sky, clouds, and green hills matching the mockup.
 */
export function PlaceholderScene() {
  return (
    <svg viewBox="0 0 180 175" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      {/* Sky */}
      <rect width="180" height="175" fill="#87CEEB" />

      {/* Clouds */}
      <g fill="white" opacity="0.9">
        <ellipse cx="45" cy="45" rx="22" ry="12" />
        <ellipse cx="60" cy="40" rx="18" ry="14" />
        <ellipse cx="35" cy="40" rx="15" ry="10" />

        <ellipse cx="130" cy="55" rx="20" ry="10" />
        <ellipse cx="142" cy="50" rx="16" ry="12" />
        <ellipse cx="122" cy="50" rx="14" ry="9" />

        <ellipse cx="90" cy="30" rx="16" ry="8" />
        <ellipse cx="100" cy="26" rx="12" ry="10" />
      </g>

      {/* Hills - back */}
      <ellipse cx="50" cy="175" rx="120" ry="70" fill="#5B8C3E" />
      <ellipse cx="150" cy="175" rx="100" ry="60" fill="#4A7A32" />

      {/* Hills - front */}
      <ellipse cx="90" cy="185" rx="140" ry="55" fill="#6BAF4B" />
    </svg>
  )
}

export default PlaceholderScene
