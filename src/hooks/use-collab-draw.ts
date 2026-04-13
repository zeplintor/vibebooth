'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  DrawStroke,
  DrawSticker,
  DrawCursor,
  DrawPattern,
  CURSOR_COLORS,
} from '@/types'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface RemoteCursor {
  readonly x: number
  readonly y: number
  readonly name: string
  readonly color: string
  readonly lastSeen: number
}

interface UseCollabDrawOptions {
  readonly roomId: string
  readonly userName: string
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** Canvas dimensions for coordinate mapping */
  readonly canvasW: number
  readonly canvasH: number
}

interface UseCollabDrawResult {
  readonly socketId: string | null
  readonly myColor: string
  readonly remoteCursors: ReadonlyMap<string, RemoteCursor>
  readonly connected: boolean
  readonly emitStroke: (stroke: Omit<DrawStroke, 'senderId'>) => void
  readonly emitSticker: (sticker: Omit<DrawSticker, 'senderId'>) => void
  readonly emitCursor: (x: number, y: number) => void
  readonly emitPattern: (patternId: string, color: string) => void
  readonly emitClear: () => void
}

const COLORS: readonly string[] = [
  '#FF6B9D', '#C084FC', '#4ADE80', '#FBBF24',
  '#3B82F6', '#F97316', '#06B6D4', '#F43F5E',
]

function pickColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function useCollabDraw({
  roomId,
  userName,
  canvasRef,
  canvasW,
  canvasH,
}: UseCollabDrawOptions): UseCollabDrawResult {
  const socketRef = useRef<TypedSocket | null>(null)
  const [socketId, setSocketId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map())
  const myColor = socketId ? pickColor(socketId) : COLORS[0]

  // Connect socket
  useEffect(() => {
    const socket: TypedSocket = io({
      path: '/api/socketio',
      autoConnect: true,
    }) as TypedSocket

    socketRef.current = socket

    socket.on('connect', () => {
      setSocketId(socket.id ?? null)
      setConnected(true)
      // Join the room for draw events
      socket.emit('room:join', { roomId, name: userName, peerId: '' })
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    // Receive remote strokes
    socket.on('draw:stroke', (data) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      ctx.beginPath()
      ctx.moveTo(data.fromX, data.fromY)
      ctx.lineTo(data.toX, data.toY)
      ctx.strokeStyle = data.color
      ctx.lineWidth = data.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    })

    // Receive remote stickers
    socket.on('draw:sticker', (data) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      ctx.font = `${data.size}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(data.emoji, data.x, data.y)
    })

    // Receive remote cursors
    socket.on('draw:cursor', (data) => {
      setRemoteCursors((prev) => {
        const next = new Map(prev)
        next.set(data.senderId, {
          x: data.x,
          y: data.y,
          name: data.senderName,
          color: data.senderColor,
          lastSeen: Date.now(),
        })
        return next
      })
    })

    // Receive remote pattern fills
    socket.on('draw:pattern', (data) => {
      // We'll handle this by re-dispatching a custom event
      // that the modal component listens to
      window.dispatchEvent(
        new CustomEvent('collab:pattern', { detail: data })
      )
    })

    // Receive remote clear
    socket.on('draw:clear', () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#F5F0E8'
      ctx.fillRect(0, 0, canvasW, canvasH)
    })

    // Clean up stale cursors every 3s
    const cursorCleanup = setInterval(() => {
      setRemoteCursors((prev) => {
        const now = Date.now()
        const next = new Map(prev)
        for (const [id, cursor] of next) {
          if (now - cursor.lastSeen > 5000) next.delete(id)
        }
        return next
      })
    }, 3000)

    return () => {
      clearInterval(cursorCleanup)
      socket.disconnect()
      socketRef.current = null
    }
  }, [roomId, userName, canvasW, canvasH])

  const emitStroke = useCallback(
    (stroke: Omit<DrawStroke, 'senderId'>) => {
      const socket = socketRef.current
      const id = socket?.id
      if (!socket || !id) return
      socket.emit('draw:stroke', { ...stroke, senderId: id, roomId })
    },
    [roomId]
  )

  const emitSticker = useCallback(
    (sticker: Omit<DrawSticker, 'senderId'>) => {
      const socket = socketRef.current
      const id = socket?.id
      if (!socket || !id) return
      socket.emit('draw:sticker', { ...sticker, senderId: id, roomId })
    },
    [roomId]
  )

  const emitCursor = useCallback(
    (x: number, y: number) => {
      const socket = socketRef.current
      const id = socket?.id
      if (!socket || !id) return
      socket.emit('draw:cursor', {
        x,
        y,
        senderId: id,
        senderName: userName,
        senderColor: pickColor(id),
        roomId,
      })
    },
    [roomId, userName]
  )

  const emitPattern = useCallback(
    (patternId: string, color: string) => {
      const socket = socketRef.current
      const id = socket?.id
      if (!socket || !id) return
      socket.emit('draw:pattern', { patternId, color, senderId: id, roomId })
    },
    [roomId]
  )

  const emitClear = useCallback(() => {
    const socket = socketRef.current
    const id = socket?.id
    if (!socket || !id) return
    socket.emit('draw:clear', { roomId, senderId: id })
  }, [roomId])

  return {
    socketId,
    myColor,
    remoteCursors,
    connected,
    emitStroke,
    emitSticker,
    emitCursor,
    emitPattern,
    emitClear,
  }
}
