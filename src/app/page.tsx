'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

const STEPS = [
  { emoji: '🔗', text: 'Envoie le lien à tes amis' },
  { emoji: '📸', text: '3 photos en mode shoot' },
  { emoji: '✏️', text: 'Dessine, stickers, chaos' },
  { emoji: '🚀', text: 'Poste direct en story' },
]

export default function HomePage() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)

  function handleCreate() {
    const roomId = uuidv4().slice(0, 8)
    router.push(`/${roomId}`)
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = joinCode.trim().toLowerCase()
    if (code) router.push(`/${code}`)
  }

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto px-4 pb-16 pt-6">

      {/* Floating deco blobs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-vb-pink/20 blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-vb-purple/20 blur-3xl" />
        <div className="absolute bottom-10 left-1/4 w-64 h-64 rounded-full bg-vb-green/20 blur-3xl" />
      </div>

      {/* Hero */}
      <section className="text-center max-w-sm w-full mt-4 mb-10">
        <div className="inline-block mb-4 px-4 py-1.5 rounded-full border-2 border-vb-pink bg-vb-pink/10 text-vb-pink font-[family-name:var(--font-hand)] text-lg font-bold rotate-[-1deg]">
          📷 photobooth viral
        </div>

        <h1 className="font-[family-name:var(--font-hand)] text-6xl font-bold text-vb-ink leading-tight mb-3">
          Fais des<br />
          <span className="text-vb-pink underline decoration-wavy decoration-vb-purple">photos folles</span><br />
          avec tes amis
        </h1>

        <p className="font-[family-name:var(--font-display)] text-vb-ink/60 text-lg mb-8">
          Chacun sur son tel. En temps réel. Trop stylé pour Instagram.
        </p>

        <button
          onClick={handleCreate}
          className="btn-sketch bg-vb-pink text-white w-full text-xl mb-3"
        >
          🎉 Créer un booth
        </button>

        <button
          onClick={() => setShowJoin(v => !v)}
          className="font-[family-name:var(--font-hand)] text-vb-ink/50 text-base underline decoration-dotted hover:text-vb-purple transition-colors"
        >
          {showJoin ? '▲ fermer' : 'J\'ai un code →'}
        </button>

        {showJoin && (
          <form onSubmit={handleJoin} className="flex gap-2 mt-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="code du booth…"
              autoFocus
              className="flex-1 px-3 py-2 rounded-lg border-2 border-vb-ink/30 font-[family-name:var(--font-display)] text-sm focus:outline-none focus:border-vb-pink bg-white"
            />
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="btn-sketch bg-vb-purple text-white !py-2 !px-4 !text-sm disabled:opacity-40"
            >
              Go
            </button>
          </form>
        )}
      </section>

      {/* How it works */}
      <section className="w-full max-w-sm">
        <p className="font-[family-name:var(--font-hand)] text-center text-vb-ink/40 text-sm mb-4 tracking-widest uppercase">
          Comment ça marche
        </p>
        <div className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="card-sketch px-5 py-3 flex items-center gap-4"
              style={{ rotate: `${(i % 2 === 0 ? -1 : 1) * 0.6}deg` }}
            >
              <span className="text-3xl">{step.emoji}</span>
              <p className="font-[family-name:var(--font-display)] text-vb-ink font-semibold text-base">
                {step.text}
              </p>
              <span className="ml-auto font-[family-name:var(--font-hand)] text-3xl font-bold text-vb-ink/15">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof strip */}
      <section className="mt-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          {['🧑‍🎤', '👩‍🦱', '🧑‍🦲', '👱‍♀️', '🧑‍🦰'].map((e, i) => (
            <span key={i} className="text-2xl" style={{ marginLeft: i > 0 ? '-8px' : 0 }}>{e}</span>
          ))}
        </div>
        <p className="font-[family-name:var(--font-hand)] text-vb-ink/50 text-lg">
          3 amis · 1 lien · des souvenirs de ouf
        </p>
      </section>

      {/* Bottom CTA */}
      <section className="mt-10 w-full max-w-sm">
        <div className="card-sketch bg-vb-purple/10 p-6 text-center">
          <p className="font-[family-name:var(--font-hand)] text-2xl font-bold text-vb-purple mb-3">
            Prêt à vibrer ? 🎆
          </p>
          <button
            onClick={handleCreate}
            className="btn-sketch bg-vb-purple text-white w-full"
          >
            Lancer maintenant
          </button>
        </div>
      </section>
    </div>
  )
}
