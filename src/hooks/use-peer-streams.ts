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
  readonly remoteStreams: readonly PeerStream[]
  readonly connectToPeer: (remotePeerId: string, remoteParticipantId: string) => void
}

/**
 * Manages PeerJS connections for exchanging camera streams.
 * Each participant creates a Peer, shares their stream, and receives remote streams.
 */
export function usePeerStreams(localStream: MediaStream | null): UsePeerStreamsResult {
  const [peerId, setPeerId] = useState<string | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<readonly PeerStream[]>([])
  const peerRef = useRef<Peer | null>(null)
  const connectionsRef = useRef<Map<string, MediaConnection>>(new Map())

  // Handle incoming stream from a call
  const handleIncomingStream = useCallback((call: MediaConnection, stream: MediaStream) => {
    const participantId = call.metadata?.participantId ?? call.peer

    setRemoteStreams((prev) => {
      // Replace existing stream for this peer or add new
      const filtered = prev.filter((s) => s.peerId !== call.peer)
      return [...filtered, { peerId: call.peer, participantId, stream }]
    })

    call.on('close', () => {
      setRemoteStreams((prev) => prev.filter((s) => s.peerId !== call.peer))
      connectionsRef.current.delete(call.peer)
    })
  }, [])

  // Initialize peer
  useEffect(() => {
    if (!localStream) return

    const peer = new Peer({
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
    })

    peerRef.current = peer

    peer.on('open', (id) => {
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
    })

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
    if (!peer || !localStream) return
    if (connectionsRef.current.has(remotePeerId)) return // already connected

    const call = peer.call(remotePeerId, localStream, {
      metadata: { participantId: remoteParticipantId },
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

  return { peerId, remoteStreams, connectToPeer }
}
