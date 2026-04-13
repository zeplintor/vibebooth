'use client'

/**
 * SVG-based leopard pattern used as the photo strip border.
 * Pink + brown spots on a cream/white base — matches the mockup.
 */
export function LeopardPatternDefs() {
  return (
    <svg width="0" height="0" className="absolute">
      <defs>
        <pattern
          id="leopard"
          patternUnits="userSpaceOnUse"
          width="60"
          height="60"
        >
          {/* Base */}
          <rect width="60" height="60" fill="#F5F0E8" />

          {/* Brown outlines */}
          <ellipse cx="15" cy="12" rx="8" ry="6" fill="none" stroke="#8B5E3C" strokeWidth="2.5" transform="rotate(-15 15 12)" />
          <ellipse cx="45" cy="10" rx="6" ry="5" fill="none" stroke="#8B5E3C" strokeWidth="2.5" transform="rotate(20 45 10)" />
          <ellipse cx="8" cy="38" rx="7" ry="5" fill="none" stroke="#8B5E3C" strokeWidth="2.5" transform="rotate(10 8 38)" />
          <ellipse cx="35" cy="35" rx="9" ry="6" fill="none" stroke="#8B5E3C" strokeWidth="2.5" transform="rotate(-25 35 35)" />
          <ellipse cx="55" cy="45" rx="6" ry="5" fill="none" stroke="#8B5E3C" strokeWidth="2.5" transform="rotate(15 55 45)" />
          <ellipse cx="25" cy="55" rx="7" ry="5" fill="none" stroke="#8B5E3C" strokeWidth="2.5" transform="rotate(-10 25 55)" />

          {/* Pink fills inside some spots */}
          <ellipse cx="15" cy="12" rx="5" ry="3.5" fill="#E87AA4" transform="rotate(-15 15 12)" />
          <ellipse cx="35" cy="35" rx="6" ry="3.5" fill="#E87AA4" transform="rotate(-25 35 35)" />
          <ellipse cx="55" cy="45" rx="3.5" ry="3" fill="#E87AA4" transform="rotate(15 55 45)" />
          <ellipse cx="8" cy="38" rx="4" ry="3" fill="#D4739A" transform="rotate(10 8 38)" />

          {/* Small accent dots */}
          <circle cx="28" cy="20" r="2" fill="#8B5E3C" />
          <circle cx="50" cy="28" r="1.5" fill="#8B5E3C" />
          <circle cx="12" cy="52" r="2" fill="#8B5E3C" />
        </pattern>
      </defs>
    </svg>
  )
}

export default LeopardPatternDefs
