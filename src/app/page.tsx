'use client'

import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

export default function HomePage() {
  const router = useRouter()

  function handleCreateBooth() {
    const roomId = uuidv4().slice(0, 8)
    router.push(`/${roomId}`)
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 mt-12">
      <div className="card-sketch p-10 text-center max-w-md">
        <h2 className="font-[family-name:var(--font-hand)] text-4xl font-bold text-vb-ink mb-3">
          Ready to vibe?
        </h2>
        <p className="text-vb-ink/70 mb-8 font-[family-name:var(--font-display)]">
          Create a booth, share the link with 3 friends, and snap photos together!
        </p>
        <button
          onClick={handleCreateBooth}
          className="btn-sketch bg-vb-pink text-white"
        >
          Create a Booth
        </button>
      </div>

      <div className="flex gap-3 mt-4">
        {[
          { color: 'bg-vb-pink', label: '1' },
          { color: 'bg-vb-purple', label: '2' },
          { color: 'bg-vb-green', label: '3' },
          { color: 'bg-vb-yellow', label: '4' },
        ].map((slot) => (
          <div
            key={slot.label}
            className={`slot-dot ${slot.color} flex items-center justify-center`}
          >
            <span className="font-[family-name:var(--font-hand)] text-white text-xl font-bold">
              {slot.label}
            </span>
          </div>
        ))}
      </div>
      <p className="font-[family-name:var(--font-hand)] text-vb-ink/50 text-lg">
        4 friends, 1 booth, infinite vibes
      </p>
    </div>
  )
}
