'use client'

interface ClaimBoothProps {
  readonly claimed: number
  readonly total?: number
}

export function ClaimBooth({ claimed, total = 3 }: ClaimBoothProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <h3 className="font-[family-name:var(--font-hand)] text-lg text-gray-600 font-bold leading-tight text-center">
        Claim Your Booth
      </h3>

      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${
              i < claimed
                ? 'bg-emerald-400 border-emerald-500'
                : 'bg-gray-100 border-gray-300'
            }`}
          />
        ))}
      </div>

      <p className="font-[family-name:var(--font-hand)] text-gray-400 text-sm">
        {claimed}/{total} seats
      </p>
    </div>
  )
}

export default ClaimBooth
