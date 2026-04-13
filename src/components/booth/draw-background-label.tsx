'use client'

/**
 * "Draw Your Background" label with paintbrush icon + arrow.
 * Decorative element pointing at the photo strip, matching the mockup.
 */
export function DrawBackgroundLabel() {
  return (
    <div className="flex items-center gap-2 select-none">
      {/* Paintbrush icon */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6B7280"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
        <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
        <path d="M14.5 17.5 4.5 15" />
      </svg>

      <span className="font-[family-name:var(--font-hand)] text-xl text-gray-500 italic">
        Draw Your<br />Background
      </span>

      {/* Arrow pointing right */}
      <svg
        width="40"
        height="24"
        viewBox="0 0 40 24"
        fill="none"
        className="ml-1"
      >
        <path
          d="M2 12 C10 11, 20 10, 32 12"
          stroke="#9CA3AF"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M28 7 L34 12 L28 17"
          stroke="#9CA3AF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  )
}

export default DrawBackgroundLabel
