'use client'

import { use, useState, useCallback, useRef, useEffect } from 'react'
import LeopardPatternDefs from '@/components/booth/leopard-pattern'
import PhotoStrip from '@/components/booth/photo-strip'
import PlaceholderScene from '@/components/booth/placeholder-scene'
import ClaimBooth from '@/components/booth/claim-booth'
import SnapButton from '@/components/booth/snap-button'
import DrawingModal from '@/components/booth/drawing-modal'
import ResultView from '@/components/booth/result-view'
import { useCamera } from '@/hooks/use-camera'
import { useRoom } from '@/hooks/use-room'
import { usePeerStreams } from '@/hooks/use-peer-streams'

type LocalPhase = 'lobby' | 'countdown' | 'capturing' | 'result'

interface RoomPageProps {
  params: Promise<{ roomId: string }>
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = use(params)

  // ── Fix 2: ask for name before joining ──────────────────────
  const [userName, setUserName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [nameReady, setNameReady] = useState(false)

  const [localPhase, setLocalPhase] = useState<LocalPhase>('lobby')
  const [drawingOpen, setDrawingOpen] = useState(false)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [capturedPhotos, setCapturedPhotos] = useState<[string, string, string] | null>(null)
  const [isJoining, setIsJoining] = useState(false) // Fix 7: loading state
  const [linkCopied, setLinkCopied] = useState(false) // Fix 4: copy link
  const hasJoined = useRef(false)
  const stripRef = useRef<HTMLDivElement>(null) // Fix 8: capture remote streams

  const { videoRef, stream, isActive, error, start, stop } = useCamera()
  const {
    socketId,
    connected,
    participants,
    myParticipant,
    join,
    setReady,
    startCountdown,
    announcePeer,
    peerAnnouncements,
    countdownValue,
    captureTriggered,
  } = useRoom(roomId)

  // PeerJS for exchanging camera streams
  // Pass socketId so metadata correctly identifies us as the caller
  const { peerId, peerError, remoteStreams, connectToPeer } = usePeerStreams(stream, socketId)

  // Announce our PeerJS ID to the room when it's ready
  // Use socketId instead of myParticipant to avoid race: myParticipant may be null
  // if room:state hasn't arrived yet when peerId becomes available
  const hasAnnouncedPeer = useRef(false)
  useEffect(() => {
    if (peerId && connected && socketId && !hasAnnouncedPeer.current) {
      hasAnnouncedPeer.current = true
      announcePeer(peerId)
    }
  }, [peerId, connected, socketId, announcePeer])

  // Connect to remote peers via two sources:
  // 1. peerAnnouncements (from socket events / room:state injection)
  // 2. participants list — if a participant already has a peerId stored server-side,
  //    connect directly without waiting for a peer:announce event
  useEffect(() => {
    if (!peerId) return // wait until our own PeerJS is open before trying to call anyone

    // Source 1: peer announcements (live events + late-joiner injection)
    for (const announcement of peerAnnouncements) {
      if (announcement.participantId !== socketId) {
        connectToPeer(announcement.peerId, announcement.participantId)
      }
    }

    // Source 2: participants with stored peerIds (handles case where we missed the announce event)
    for (const p of participants) {
      if (p.id !== socketId && p.peerId) {
        connectToPeer(p.peerId, p.id)
      }
    }
  }, [peerAnnouncements, participants, socketId, connectToPeer, peerId])

  // Fix 2: submit name form
  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = nameInput.trim()
    if (!name) return
    setUserName(name)
    setNameReady(true)
  }

  // Join booth = request camera + join socket room (once)
  // Fix 7: loading state around camera start
  async function handleClaim() {
    if (isActive || hasJoined.current) return
    hasJoined.current = true
    setIsJoining(true)
    try {
      await start()
      join(userName)
    } finally {
      setIsJoining(false)
    }
  }

  // Once camera is active, tell server we're ready
  useEffect(() => {
    if (isActive && myParticipant && myParticipant.status === 'waiting') {
      setReady()
    }
  }, [isActive, myParticipant, setReady])

  // Fix 6: rely solely on server captureTriggered — no local countdown fallback
  useEffect(() => {
    if (captureTriggered && localPhase === 'countdown') {
      setLocalPhase('capturing')
    }
  }, [captureTriggered, localPhase])

  const showCountdown = countdownValue !== null && countdownValue > 0

  // Fix 8: capture all visible video streams in the strip
  const captureAllSlots = useCallback(async (): Promise<[string, string, string] | null> => {
    const container = stripRef.current
    if (!container) return null
    const videos = Array.from(container.querySelectorAll('video'))
    const results: string[] = []

    for (const video of videos.slice(0, 3)) {
      const w = video.videoWidth || 640
      const h = video.videoHeight || 480
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0)
      results.push(canvas.toDataURL('image/png'))
    }

    // Pad to 3 (solo = mirrors)
    const fallback = results[0] ?? ''
    while (results.length < 3) results.push(fallback)
    return results as [string, string, string]
  }, [])

  // Sequential capture phase (3 photos, 1.5 s apart)
  const photosBufferRef = useRef<string[]>([])
  const [captureIndex, setCaptureIndex] = useState(0)

  useEffect(() => {
    if (localPhase !== 'capturing') return

    if (photosBufferRef.current.length >= 3) {
      setCapturedPhotos(photosBufferRef.current as [string, string, string])
      stop()
      setLocalPhase('result')
      return
    }

    const delay = photosBufferRef.current.length === 0 ? 300 : 1500
    const timer = setTimeout(async () => {
      const slots = await captureAllSlots()
      if (slots) {
        // Capture the "main" frame for this shot: use the slot matching the current photo index
        // (so photo 0 = slot 0 / local cam, photo 1 = slot 1 / remote 1, photo 2 = slot 2 / remote 2)
        // For a classic strip feel, each photo shows all 3 at once — use slot 0 (local cam) each time
        // but with the remote frames composited in slots 1 & 2 this is the most natural single-frame pick
        const frameIndex = photosBufferRef.current.length
        const frame = slots[frameIndex] ?? slots[0]
        photosBufferRef.current = [...photosBufferRef.current, frame]
        setCaptureIndex(photosBufferRef.current.length)
      } else {
        setCaptureIndex((prev) => prev + 0.001)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [localPhase, captureIndex, captureAllSlots, stop])

  // Fix 4: copy invite link
  function handleCopyLink() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  function handleRetake() {
    setCapturedPhotos(null)
    photosBufferRef.current = []
    setCaptureIndex(0)
    hasJoined.current = false
    setLocalPhase('lobby')
  }

  function handleSnap() {
    // Fix 6: set countdown phase only after emitting — server drives the tick
    if (connected) {
      startCountdown()
    }
    setLocalPhase('countdown')
  }

  // ─── Build frames ──────────────────────────────────────────
  const videoElement = (
    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
  )

  const remoteParticipants = participants.filter((p) => p.id !== (myParticipant?.id ?? socketId))

  function getSlotContent(remoteIndex: number): React.ReactNode {
    const remote = remoteParticipants[remoteIndex]
    if (remote) {
      const peerStream = remoteStreams.find((s) => s.participantId === remote.id)
      if (peerStream) {
        return <LiveMirror key={`remote-${remoteIndex}`} stream={peerStream.stream} />
      }
      return <RemoteSlot key={`wait-${remoteIndex}`} name={remote.name} ready={remote.status === 'camera_ready'} />
    }
    return <LiveMirror key={`mirror-${remoteIndex}`} stream={stream} />
  }

  const frames: [React.ReactNode, React.ReactNode, React.ReactNode] = isActive
    ? [videoElement, getSlotContent(0), getSlotContent(1)]
    : [<PlaceholderScene key="0" />, <PlaceholderScene key="1" />, <PlaceholderScene key="2" />]

  const claimedCount = Math.max(isActive ? 1 : 0, participants.length)

  // ─── Result ────────────────────────────────────────────────
  if (localPhase === 'result' && capturedPhotos) {
    return (
      <div className="flex flex-col items-center w-full h-full min-h-0">
        <ResultView photos={capturedPhotos} backgroundUrl={backgroundUrl} onRetake={handleRetake} roomId={roomId} />
      </div>
    )
  }

  // ─── Fix 2: Name entry screen ──────────────────────────────
  if (!nameReady) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-0 gap-6">
        <LeopardPatternDefs />
        <div className="card-sketch p-8 text-center max-w-xs w-full">
          <h2 className="font-[family-name:var(--font-hand)] text-3xl font-bold text-vb-ink mb-2">
            What's your name?
          </h2>
          <p className="font-[family-name:var(--font-display)] text-vb-ink/60 text-sm mb-6">
            So your friends know it's you 📸
          </p>
          <form onSubmit={handleNameSubmit} className="flex flex-col gap-3">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name…"
              maxLength={20}
              className="px-3 py-2.5 rounded-lg border-2 border-vb-ink/30 font-[family-name:var(--font-display)] text-sm focus:outline-none focus:border-vb-pink bg-white text-center"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="btn-sketch bg-vb-pink text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Enter Booth ✨
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Lobby ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center w-full h-full min-h-0">
      <LeopardPatternDefs />

      {/* Temporary debug panel — remove after fixing streams */}
      {process.env.NODE_ENV !== 'production' || true ? (
        <details className="fixed bottom-2 right-2 z-50 bg-black/80 text-white text-[10px] font-mono p-2 rounded max-w-xs">
          <summary className="cursor-pointer">🔧 debug</summary>
          <div className="mt-1 space-y-0.5">
            <div>socket: {socketId?.slice(0, 8) ?? 'null'} {connected ? '✅' : '❌'}</div>
            <div>peerId: {peerId?.slice(0, 8) ?? 'null'}</div>
            <div>participants: {participants.length} ({participants.map(p => `${p.name}[${p.peerId?.slice(0,4) ?? 'no-peer'}]`).join(', ')})</div>
            <div>remoteStreams: {remoteStreams.length} ({remoteStreams.map(s => `${s.participantId.slice(0,8)}`).join(', ')})</div>
            <div>announcements: {peerAnnouncements.length}</div>
            {peerError && <div className="text-red-400">peerErr: {peerError}</div>}
          </div>
        </details>
      ) : null}

      {/* Fix 4: room code + copy link button */}
      <div className="flex items-center gap-3 mb-2 shrink-0">
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 font-[family-name:var(--font-hand)] text-base hover:opacity-70 transition-opacity"
          title="Copy invite link"
        >
          <span className="text-gray-400">Room:</span>
          <span className="font-mono text-vb-pink font-bold tracking-wider">{roomId}</span>
          {linkCopied ? (
            <span className="text-xs text-emerald-500 font-[family-name:var(--font-display)]">✓ Copied!</span>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          )}
        </button>
        {connected ? (
          <span className="flex items-center gap-1 text-xs font-[family-name:var(--font-display)] text-emerald-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {participants.length} online
          </span>
        ) : (
          <span className="text-xs font-[family-name:var(--font-display)] text-gray-400">connecting...</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg px-3 py-1 mb-2 text-red-600 text-xs font-[family-name:var(--font-display)] shrink-0">
          Camera error: {error}
        </div>
      )}

      {/* Fix 5: solo waiting message */}
      {isActive && participants.length <= 1 && (
        <div className="flex items-center gap-2 mb-2 shrink-0 bg-vb-yellow/20 border border-vb-yellow/50 rounded-full px-4 py-1.5">
          <span className="font-[family-name:var(--font-hand)] text-vb-ink/70 text-sm">
            👋 Share the link with friends to fill the booth!
          </span>
          <button
            onClick={handleCopyLink}
            className="text-xs font-[family-name:var(--font-display)] font-semibold text-vb-pink hover:underline"
          >
            {linkCopied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className="flex items-center justify-center gap-4 md:gap-8 flex-1 min-h-0 w-full max-w-3xl">
        {/* Left: draw background button */}
        <div className="hidden md:flex flex-col items-center gap-2 shrink-0">
          <button onClick={() => setDrawingOpen(true)} className="btn-sketch bg-white text-vb-ink !text-xs !py-2 !px-3 !border-2 !shadow-[3px_3px_0_var(--vb-border)]">
            <span className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
                <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
              </svg>
              Draw BG
            </span>
          </button>
        </div>

        {/* Center: photo strip — Fix 8: wrapped in stripRef */}
        <div ref={stripRef}>
          <PhotoStrip frames={frames} rotation={-3} backgroundUrl={backgroundUrl} />
        </div>

        {/* Right: claim + participants + snap */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <ClaimBooth claimed={claimedCount} />

          {/* Participant names */}
          {participants.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className="text-xs font-[family-name:var(--font-hand)] text-gray-500 flex items-center gap-1"
                >
                  <span className={`w-2 h-2 rounded-full ${p.status === 'camera_ready' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  {p.name} {p.id === (myParticipant?.id ?? socketId) ? '(you)' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Fix 7: loading state on Join Booth */}
          {!isActive && (
            <button
              onClick={handleClaim}
              disabled={isJoining}
              className="btn-sketch bg-vb-green text-white !text-sm !py-2 !px-3 !border-2 !shadow-[3px_3px_0_var(--vb-border)] disabled:opacity-60 disabled:cursor-wait"
            >
              {isJoining ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Joining…
                </span>
              ) : (
                'Join Booth'
              )}
            </button>
          )}

          <button
            onClick={() => setDrawingOpen(true)}
            className="md:hidden btn-sketch bg-white text-vb-ink !text-xs !py-1 !px-3 !border-2 !shadow-[2px_2px_0_var(--vb-border)]"
          >
            Draw BG
          </button>

          <div className="mt-2">
            <SnapButton disabled={!isActive || localPhase !== 'lobby'} onClick={handleSnap} />
          </div>
        </div>
      </div>

      {/* Capturing indicator */}
      {localPhase === 'capturing' && (
        <div className="shrink-0 py-1 font-[family-name:var(--font-hand)] text-xl text-vb-pink animate-pulse">
          Capturing {Math.min(Math.floor(captureIndex) + 1, 3)} / 3
        </div>
      )}

      {/* Fix 6: only server countdown overlay */}
      {showCountdown && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div key={countdownValue} className="countdown-number text-white drop-shadow-lg">
            {countdownValue}
          </div>
        </div>
      )}

      <DrawingModal open={drawingOpen} onClose={() => setDrawingOpen(false)} onSave={(url) => setBackgroundUrl(url)} roomId={roomId} userName={userName} />
    </div>
  )
}

function RemoteSlot({ name, ready }: { name: string; ready: boolean }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white ${ready ? 'bg-emerald-400' : 'bg-gray-300'}`}>
        {name.charAt(0).toUpperCase()}
      </div>
      <span className="mt-1 text-xs font-[family-name:var(--font-hand)] text-gray-500">{name}</span>
      <span className={`text-[10px] ${ready ? 'text-emerald-500' : 'text-gray-400'}`}>
        {ready ? 'connecting camera...' : 'joining...'}
      </span>
    </div>
  )
}

function LiveMirror({ stream }: { stream: MediaStream | null }) {
  const mirrorRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const mirror = mirrorRef.current
    if (!mirror || !stream) return
    mirror.srcObject = stream
    mirror.play().catch(() => {})
  }, [stream])

  return <video ref={mirrorRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
}
