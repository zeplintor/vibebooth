'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

interface UseCameraResult {
  readonly videoRef: React.RefObject<HTMLVideoElement | null>
  readonly stream: MediaStream | null
  readonly isActive: boolean
  readonly error: string | null
  readonly start: () => Promise<void>
  readonly stop: () => void
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Attach stream to video element whenever either changes.
  // This runs AFTER React renders the <video> element,
  // solving the race condition where start() fires before mount.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return

    if (video.srcObject !== stream) {
      video.srcObject = stream
      video.play().catch(() => {})
    }
  }, [stream, isActive]) // isActive triggers re-render that mounts <video>

  const start = useCallback(async () => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = mediaStream
      setStream(mediaStream)
      setIsActive(true)
      // Don't attach to videoRef here — the effect above handles it
      // after React re-renders and mounts the <video> element.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Camera access denied'
      setError(message)
      setIsActive(false)
    }
  }, [])

  const stop = useCallback(() => {
    const s = streamRef.current
    if (s) {
      s.getTracks().forEach((track) => track.stop())
    }
    streamRef.current = null
    setStream(null)
    setIsActive(false)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const s = streamRef.current
      if (s) {
        s.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return { videoRef, stream, isActive, error, start, stop }
}
