'use client'

import { use, useState, useCallback, useRef, useEffect } from 'react'
import LeopardPatternDefs from '@/components/booth/leopard-pattern'
import PhotoStrip from '@/components/booth/photo-strip'
import PlaceholderScene from '@/components/booth/placeholder-scene'
import ClaimBooth from '@/components/booth/claim-booth'
import SnapButton from '@/components/booth/snap-button'
import DrawingModal from '@/components/booth/drawing-modal'
import CountdownOverlay from '@/components/booth/countdown-overlay'
import ResultView from '@/components/booth/result-view'
import { useCamera } from '@/hooks/use-camera'
import { useRoom } from '@/hooks/use-room'

type LocalPhase = 'lobby' | 'countdown' | 'capturing' | 'result'

interface RoomPageProps {
  params: Promise<{ roomId: string }>
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = use(params)

  const [userName] = useState(() => `User-${Math.random().toString(36).slice(2, 6)}`)
  const [localPhase, setLocalPhase] = useState<LocalPhase>('lobby')
  const [drawingOpen, setDrawingOpen] = useState(false)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [capturedPhotos, setCapturedPhotos] = useState<[string, string, string] | null>(null)
  const [captureIndex, setCaptureIndex] = useState(0)
  const photosBuffer = useRef<string[]>([])

  const { videoRef, stream, isActive, error, start, stop } = useCamera()
  const {
    connected,
    participants,
    myParticipant,
    join,
    setReady,
    startCountdown,
    countdownValue,
    captureTriggered,
  } = useRoom(roomId)

  // Join booth = request camera + join socket room
  async function handleClaim() {
    if (isActive) return
    await start()
    join(userName)
  }

  // Once camera is active, tell server we're ready
  useEffect(() => {
    if (isActive && myParticipant && myParticipant.status === 'waiting') {
      setReady()
    }
  }, [isActive, myParticipant, setReady])

  // Server-triggered capture
  useEffect(() => {
    if (captureTriggered && localPhase === 'countdown') {
      setLocalPhase('capturing')
      photosBuffer.current = []
      setCaptureIndex(0)
    }
  }, [captureTriggered, localPhase])

  // Show countdown from server
  const showCountdown = countdownValue !== null && countdownValue > 0 && localPhase === 'countdown'

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/png')
  }, [])

  // Sequential capture
  useEffect(() => {
    if (localPhase !== 'capturing') return
    if (photosBuffer.current.length >= 3) {
      setCapturedPhotos(photosBuffer.current as [string, string, string])
      stop()
      setLocalPhase('result')
      return
    }

    const delay = photosBuffer.current.length === 0 ? 300 : 1500
    const timer = setTimeout(() => {
      const frame = captureFrame()
      if (frame) {
        photosBuffer.current = [...photosBuffer.current, frame]
        setCaptureIndex(photosBuffer.current.length)
      } else {
        setCaptureIndex((prev) => prev + 0.001)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [localPhase, captureIndex, captureFrame, stop])

  function handleRetake() {
    setCapturedPhotos(null)
    photosBuffer.current = []
    setCaptureIndex(0)
    setLocalPhase('lobby')
  }

  // Host starts countdown via socket (or local if solo)
  function handleSnap() {
    setLocalPhase('countdown')
    if (connected && participants.length > 1) {
      startCountdown()
    }
  }

  const handleCountdownComplete = useCallback(() => {
    setLocalPhase('capturing')
    photosBuffer.current = []
    setCaptureIndex(0)
  }, [])

  const videoElement = (
    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
  )

  const frames: [React.ReactNode, React.ReactNode, React.ReactNode] = isActive
    ? [videoElement, <LiveMirror key="1" stream={stream} />, <LiveMirror key="2" stream={stream} />]
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

  // ─── Lobby ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center w-full h-full min-h-0">
      <LeopardPatternDefs />

      {/* Room code + connection status */}
      <div className="flex items-center gap-3 mb-2 shrink-0">
        <p className="font-[family-name:var(--font-hand)] text-gray-400 text-base">
          Room: <span className="font-mono text-vb-pink font-bold tracking-wider">{roomId}</span>
        </p>
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

        {/* Center: photo strip */}
        <PhotoStrip frames={frames} rotation={-3} backgroundUrl={backgroundUrl} />

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
                  {p.name}
                </span>
              ))}
            </div>
          )}

          {!isActive && (
            <button onClick={handleClaim} className="btn-sketch bg-vb-green text-white !text-sm !py-2 !px-3 !border-2 !shadow-[3px_3px_0_var(--vb-border)]">
              Join Booth
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

      {/* Countdown: local (solo) or show server value */}
      {localPhase === 'countdown' && !showCountdown && (
        <CountdownOverlay onComplete={handleCountdownComplete} />
      )}
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
