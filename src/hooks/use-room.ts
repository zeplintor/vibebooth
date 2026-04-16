'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  Room,
  Participant,
  RoomPhase,
} from '@/types'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface PeerAnnounce {
  readonly participantId: string
  readonly peerId: string
}

interface UseRoomResult {
  readonly socketId: string | null
  readonly connected: boolean
  readonly room: Room | null
  readonly participants: readonly Participant[]
  readonly myParticipant: Participant | null
  readonly phase: RoomPhase
  readonly join: (name: string, peerId?: string) => void
  readonly setReady: () => void
  readonly startCountdown: () => void
  readonly announcePeer: (peerId: string) => void
  readonly peerAnnouncements: readonly PeerAnnounce[]
  readonly countdownValue: number | null
  readonly captureTriggered: boolean
}

// Module-level singleton: one socket per page load, shared across remounts.
// Without this, React StrictMode / Fast Refresh / parent re-renders can mount
// the hook twice, opening two sockets that race each other on room:join.
let sharedSocket: TypedSocket | null = null
let sharedSocketRoomId: string | null = null

function getOrCreateSocket(roomId: string): TypedSocket {
  if (sharedSocket && sharedSocketRoomId === roomId) {
    return sharedSocket
  }
  if (sharedSocket) {
    sharedSocket.disconnect()
  }
  sharedSocket = io({
    path: '/api/socketio',
    autoConnect: true,
    transports: ['websocket', 'polling'],
  }) as TypedSocket
  sharedSocketRoomId = roomId
  return sharedSocket
}

export function useRoom(roomId: string): UseRoomResult {
  const socketRef = useRef<TypedSocket | null>(null)
  const [socketId, setSocketId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [captureTriggered, setCaptureTriggered] = useState(false)
  const [peerAnnouncements, setPeerAnnouncements] = useState<readonly PeerAnnounce[]>([])
  // Pending/active join name — used to retry on connect/reconnect
  const pendingJoinRef = useRef<string | null>(null)
  const joinedNameRef = useRef<string | null>(null)

  useEffect(() => {
    const socket = getOrCreateSocket(roomId)
    socketRef.current = socket

    // If socket already connected (singleton reuse), sync state immediately
    if (socket.connected) {
      setSocketId(socket.id ?? null)
      setConnected(true)
    }

    socket.on('connect', () => {
      setSocketId(socket.id ?? null)
      setConnected(true)
      // Re-join on connect/reconnect if we had joined before (handles server restarts)
      const nameToJoin = pendingJoinRef.current ?? joinedNameRef.current
      if (nameToJoin) {
        socket.emit('room:join', { roomId, name: nameToJoin, peerId: '' })
        pendingJoinRef.current = null
      }
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setSocketId(null)
    })

    socket.on('room:state', (updatedRoom) => {
      console.log('[client] room:state received, participants=', updatedRoom.participants.length, updatedRoom.participants.map(p => p.name))
      setRoom(updatedRoom)
      // When we receive room state, inject peer IDs of existing participants
      // so late joiners can connect to peers who announced before they arrived
      const existingPeers = updatedRoom.participants.filter(
        (p) => p.peerId && p.id !== socket.id
      )
      if (existingPeers.length > 0) {
        setPeerAnnouncements((prev) => {
          // Drop any stale announcement for these participants, then re-add with current peerId
          const participantIds = new Set(existingPeers.map((p) => p.id))
          const filtered = prev.filter((a) => !participantIds.has(a.participantId))
          return [
            ...filtered,
            ...existingPeers.map((p) => ({ participantId: p.id, peerId: p.peerId })),
          ]
        })
      }
    })

    socket.on('countdown:tick', (seconds) => {
      setCountdownValue(seconds)
    })

    socket.on('countdown:capture', () => {
      setCaptureTriggered(true)
    })

    socket.on('phase:change', (newPhase) => {
      setRoom((prev) => prev ? { ...prev, phase: newPhase } : prev)
      // Reset captureTriggered when returning to lobby so the next snap works
      if (newPhase === 'lobby') {
        setCaptureTriggered(false)
        setCountdownValue(null)
      }
    })

    socket.on('peer:announce', (data) => {
      setPeerAnnouncements((prev) => {
        // Remove any announcement for this participant OR with this peerId (dedup both ways)
        const filtered = prev.filter(
          (p) => p.participantId !== data.participantId && p.peerId !== data.peerId
        )
        return [...filtered, data]
      })
    })

    socket.on('error', (msg) => {
      console.warn('[VibeBooth socket error]', msg)
    })

    return () => {
      // Detach listeners but keep the socket alive for potential remount.
      // The socket is only closed when the roomId changes (handled in getOrCreateSocket)
      // or when the page unloads (browser does it automatically).
      socket.off('connect')
      socket.off('disconnect')
      socket.off('room:state')
      socket.off('countdown:tick')
      socket.off('countdown:capture')
      socket.off('phase:change')
      socket.off('peer:announce')
      socket.off('error')
      socketRef.current = null
    }
  }, [roomId])

  const join = useCallback((name: string, peerId: string = '') => {
    const socket = socketRef.current
    if (!socket) return
    joinedNameRef.current = name
    if (socket.connected) {
      socket.emit('room:join', { roomId, name, peerId })
    } else {
      pendingJoinRef.current = name
    }
  }, [roomId])

  const setReady = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    socket.emit('room:camera-ready', roomId)
  }, [roomId])

  const startCountdown = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    socket.emit('countdown:start', roomId)
  }, [roomId])

  const announcePeer = useCallback((peerId: string) => {
    const socket = socketRef.current
    if (!socket) {
      console.warn('[announcePeer] socket not ready')
      return
    }
    console.log(`[announcePeer] emitting peerId=${peerId} roomId=${roomId} socketId=${socket.id}`)
    socket.emit('peer:announce', { roomId, peerId })
  }, [roomId])

  const participants = room?.participants ?? []
  const myParticipant = participants.find((p) => p.id === socketId) ?? null
  const phase = room?.phase ?? 'lobby'

  return {
    socketId,
    connected,
    room,
    participants,
    myParticipant,
    phase,
    join,
    setReady,
    startCountdown,
    announcePeer,
    peerAnnouncements,
    countdownValue,
    captureTriggered,
  }
}
