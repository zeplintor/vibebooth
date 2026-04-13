'use client'

interface SnapButtonProps {
  readonly disabled?: boolean
  readonly onClick?: () => void
}

export function SnapButton({ disabled = true, onClick }: SnapButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`
        flex items-center gap-2 px-5 py-2.5 rounded-full font-[family-name:var(--font-display)] font-semibold text-sm
        text-white shadow-lg transition-all duration-200
        ${disabled
          ? 'bg-gray-300 cursor-not-allowed opacity-60'
          : 'bg-indigo-500 hover:bg-indigo-600 hover:shadow-xl hover:scale-105 active:scale-95 cursor-pointer'
        }
      `}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
      Snap!
    </button>
  )
}

export default SnapButton
