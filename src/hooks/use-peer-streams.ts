'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Peer, { type MediaConnection } from 'peerjs'

interface PeerStream {
  readonly peerId: string
  readonly participantId: string
  readonly stream: MediaStream
}

interface UsePeerStreamsResult {
  readonly peerId: string | null
  readonly peerError: string | null
  // streams keyed by the remote PeerJS peer ID (not socket ID)
  readonly remoteStreams: readonly PeerStream[]
  readonly connectToPeer: (remotePeerId: string, remoteParticipantId: string) => void
}

/**
 * Manages PeerJS connections for exchanging camera streams.
 * Each participant creates a Peer, shares their stream, and receives remote streams.
 */
export function usePeerStreams(localStream: MediaStream | null, myParticipantId: string | null = null): UsePeerStreamsResult {
  const [peerId, setPeerId] = useState<string | null>(null)
  const [peerError, setPeerError] = useState<string | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<readonly PeerStream[]>([])
  const peerRef = useRef<Peer | null>(null)
  const connectionsRef = useRef<Map<string, MediaConnection>>(new Map())

  // Handle incoming stream from a call
  // Use call.peer (PeerJS ID) as the key — participantId matching happens in the component
  // Skip if the stream is from ourselves (avoid echo/duplicate)
  const handleIncomingStream = useCallback((call: MediaConnection, stream: MediaStream) => {
    // Reject our own stream (in case of echo or loopback)
    if (call.peer === peerId) {
      console.log('[PeerJS] ignoring own stream echo from peerId=', call.peer)
      return
    }

    console.log('[PeerJS] incoming stream from peerId=', call.peer)
    setRemoteStreams((prev) => {
      const filtered = prev.filter((s) => s.peerId !== call.peer)
      // Store peerId as both peerId and participantId — component matches by peerId via participants list
      return [...filtered, { peerId: call.peer, participantId: call.peer, stream }]
    })

    call.on('close', () => {
      setRemoteStreams((prev) => prev.filter((s) => s.peerId !== call.peer))
      connectionsRef.current.delete(call.peer)
    })
  }, [peerId])

  // Initialize peer
  useEffect(() => {
    if (!localStream) return

    // Use our own PeerJS server (self-hosted on the VPS) for reliability
    // Falls back to peerjs.com if env var not set (local dev)
    const peerHost = process.env.NEXT_PUBLIC_PEERJS_HOST ?? '0.peerjs.com'
    const peerPort = parseInt(process.env.NEXT_PUBLIC_PEERJS_PORT ?? '443')
    const peerPath = process.env.NEXT_PUBLIC_PEERJS_PATH ?? '/'
    const peerSecure = (process.env.NEXT_PUBLIC_PEERJS_SECURE ?? 'true') === 'true'

    // ICE servers: STUN for direct connections + TURN for NAT traversal
    // Without TURN, WebRTC fails between different networks (mobile, different ISPs)
    const turnHost = process.env.NEXT_PUBLIC_TURN_HOST
    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
    if (turnHost) {
      const turnUser = process.env.NEXT_PUBLIC_TURN_USER ?? 'vibebooth'
      const turnPass = process.env.NEXT_PUBLIC_TURN_PASS ?? 'vibebooth2024'
      iceServers.push(
        { urls: `turn:${turnHost}:3478`, username: turnUser, credential: turnPass },
        { urls: `turns:${turnHost}:5349`, username: turnUser, credential: turnPass },
      )
    }

    const peer = new Peer({
      host: peerHost,
      port: peerPort,
      path: peerPath,
      secure: peerSecure,
      key: process.env.NEXT_PUBLIC_PEERJS_KEY ?? 'peerjs',
      config: { iceServers },
    })

    peerRef.current = peer

    peer.on('open', (id) => {
      console.log('[PeerJS] open, id=', id)
      setPeerId(id)
    })

    // Answer incoming calls with our local stream
    peer.on('call', (call) => {
      call.answer(localStream)
      call.on('stream', (remoteStream) => {
        handleIncomingStream(call, remoteStream)
      })
    })

    peer.on('error', (err) => {
      console.warn('[PeerJS error]', err.type, err.message)
      setPeerError(`${err.type}: ${err.message}`)
    })

    peer.on('disconnected', () => {
      console.warn('[PeerJS] disconnected from server')
    })

    console.log('[PeerJS] connecting to', peerHost, peerPort, peerPath, 'secure=', peerSecure)

    return () => {
      connectionsRef.current.forEach((conn) => conn.close())
      connectionsRef.current.clear()
      peer.destroy()
      peerRef.current = null
      setPeerId(null)
      setRemoteStreams([])
    }
  }, [localStream, handleIncomingStream])

  // Call a remote peer to exchange streams
  const connectToPeer = useCallback((remotePeerId: string, remoteParticipantId: string) => {
    const peer = peerRef.current
    // Guard: skip if our PeerJS isn't ready yet or stream not available
    if (!peer || peer.destroyed || !localStream) return
    // Skip only if already have an active connection (not just a failed attempt)
    const existing = connectionsRef.current.get(remotePeerId)
    if (existing && existing.open) return

    // Remove stale/closed connection before retrying
    if (existing) {
      existing.close()
      connectionsRef.current.delete(remotePeerId)
    }

    // Pass OUR own participantId in metadata so the receiver knows who is calling
    const call = peer.call(remotePeerId, localStream, {
      metadata: { participantId: myParticipantId ?? remoteParticipantId },
    })

    connectionsRef.current.set(remotePeerId, call)

    call.on('stream', (remoteStream) => {
      handleIncomingStream(call, remoteStream)
    })

    call.on('close', () => {
      setRemoteStreams((prev) => prev.filter((s) => s.peerId !== remotePeerId))
      connectionsRef.current.delete(remotePeerId)
    })

    call.on('error', (err) => {
      console.warn('[PeerJS call error]', err)
      connectionsRef.current.delete(remotePeerId)
    })
  }, [localStream, handleIncomingStream])

  return { peerId, peerError, remoteStreams, connectToPeer }
}
