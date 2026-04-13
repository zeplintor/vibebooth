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

  useEffect(() => {
    const socket: TypedSocket = io({
      path: '/api/socketio',
      autoConnect: true,
    }) as TypedSocket

    socketRef.current = socket

    socket.on('connect', () => {
      setSocketId(socket.id ?? null)
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setSocketId(null)
    })

    socket.on('room:state', (updatedRoom) => {
      setRoom(updatedRoom)
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

    socket.on('error', (msg) => {
      // Could show toast here, for now just log
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
    socket.emit('room:join', { roomId, name, peerId: '' })
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
    countdownValue,
    captureTriggered,
  }
}
