'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

export default function HomePage() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')

  function handleCreateBooth() {
    const roomId = uuidv4().slice(0, 8)
    router.push(`/${roomId}`)
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = joinCode.trim().toLowerCase()
    if (code) router.push(`/${code}`)
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 mt-12">
      <div className="card-sketch p-10 text-center max-w-md w-full">
        <h2 className="font-[family-name:var(--font-hand)] text-4xl font-bold text-vb-ink mb-3">
          Ready to vibe?
        </h2>
        <p className="text-vb-ink/70 mb-8 font-[family-name:var(--font-display)]">
          Create a booth, share the link with friends, and snap photos together!
        </p>

        <button
          onClick={handleCreateBooth}
          className="btn-sketch bg-vb-pink text-white w-full mb-6"
        >
          Create a Booth
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-vb-ink/20" />
          <span className="font-[family-name:var(--font-hand)] text-vb-ink/40 text-sm">or join one</span>
          <div className="flex-1 h-px bg-vb-ink/20" />
        </div>

        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter room code…"
            className="flex-1 px-3 py-2 rounded-lg border-2 border-vb-ink/30 font-[family-name:var(--font-display)] text-sm focus:outline-none focus:border-vb-pink bg-white"
          />
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="btn-sketch bg-vb-purple text-white !py-2 !px-4 !text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Join
          </button>
        </form>
      </div>

      <div className="flex gap-3 mt-4">
        {[
          { color: 'bg-vb-pink', label: '1' },
          { color: 'bg-vb-purple', label: '2' },
          { color: 'bg-vb-green', label: '3' },
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
        3 friends, 1 booth, infinite vibes
      </p>
    </div>
  )
}
