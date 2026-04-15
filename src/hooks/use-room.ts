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
  readonly join: (name: string) => void
  readonly setReady: () => void
  readonly startCountdown: () => void
  readonly announcePeer: (peerId: string) => void
  readonly peerAnnouncements: readonly PeerAnnounce[]
  readonly countdownValue: number | null
  readonly captureTriggered: boolean
}

export function useRoom(roomId: string): UseRoomResult {
  const socketRef = useRef<TypedSocket | null>(null)
  const [socketId, setSocketId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [captureTriggered, setCaptureTriggered] = useState(false)
  const [peerAnnouncements, setPeerAnnouncements] = useState<readonly PeerAnnounce[]>([])
  // Pending join: if join() is called before socket connects, retry on connect
  const pendingJoinRef = useRef<string | null>(null)

  useEffect(() => {
    const socket: TypedSocket = io({
      path: '/api/socketio',
      autoConnect: true,
    }) as TypedSocket

    socketRef.current = socket

    socket.on('connect', () => {
      setSocketId(socket.id ?? null)
      setConnected(true)
      // Retry pending join if join() was called before socket was ready
      if (pendingJoinRef.current !== null) {
        socket.emit('room:join', { roomId, name: pendingJoinRef.current, peerId: '' })
        pendingJoinRef.current = null
      }
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setSocketId(null)
    })

    socket.on('room:state', (updatedRoom) => {
      setRoom(updatedRoom)
      // When we receive room state, inject peer IDs of existing participants
      // so late joiners can connect to peers who announced before they arrived
      const existingPeers = updatedRoom.participants.filter(
        (p) => p.peerId && p.id !== socket.id
      )
      if (existingPeers.length > 0) {
        setPeerAnnouncements((prev) => {
          const updated = [...prev]
          for (const p of existingPeers) {
            const alreadyKnown = updated.some((a) => a.participantId === p.id)
            if (!alreadyKnown) {
              updated.push({ participantId: p.id, peerId: p.peerId })
            }
          }
          return updated
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
    })

    socket.on('peer:announce', (data) => {
      setPeerAnnouncements((prev) => {
        const filtered = prev.filter((p) => p.participantId !== data.participantId)
        return [...filtered, data]
      })
    })

    socket.on('error', (msg) => {
      console.warn('[VibeBooth socket error]', msg)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [roomId])

  const join = useCallback((name: string) => {
    const socket = socketRef.current
    if (!socket) return
    if (socket.connected) {
      socket.emit('room:join', { roomId, name, peerId: '' })
    } else {
      // Socket not yet connected — store name and emit on connect
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
    if (!socket) return
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
