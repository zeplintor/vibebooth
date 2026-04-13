import type { Server, Socket } from 'socket.io'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  Participant,
} from '../../src/types'
import { MAX_PARTICIPANTS } from '../../src/types'
import {
  getRoom,
  createRoom,
  addParticipant,
  removeParticipant,
  setParticipantReady,
  setRoomPhase,
} from '../state'

type IO = Server<ClientToServerEvents, ServerToClientEvents>
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>

const COUNTDOWN_SECONDS = 3

function findNextSlot(room: ReturnType<typeof getRoom>): number {
  if (!room) return 0
  const taken = new Set(room.participants.map((p) => p.slotIndex))
  for (let i = 0; i < MAX_PARTICIPANTS; i++) {
    if (!taken.has(i)) return i
  }
  return -1
}

export function registerRoomHandlers(io: IO, socket: IOSocket): void {
  // Track which room this socket is in
  let currentRoomId: string | null = null
  let currentParticipantId: string | null = null

  socket.on('room:join', ({ roomId, name, peerId }) => {
    let room = getRoom(roomId)

    // Create room if it doesn't exist — first joiner becomes host
    if (!room) {
      room = createRoom(roomId, socket.id)
    }

    if (room.participants.length >= MAX_PARTICIPANTS) {
      socket.emit('error', 'Room is full (4/4)')
      return
    }

    const slotIndex = findNextSlot(room)
    if (slotIndex === -1) {
      socket.emit('error', 'No slot available')
      return
    }

    const participant: Participant = {
      id: socket.id,
      peerId,
      name,
      slotIndex,
      status: 'waiting',
      isHost: room.participants.length === 0,
    }

    const updated = addParticipant(roomId, participant)
    if (!updated) {
      socket.emit('error', 'Failed to join room')
      return
    }

    currentRoomId = roomId
    currentParticipantId = socket.id

    socket.join(roomId)
    io.to(roomId).emit('room:state', updated)
    socket.to(roomId).emit('room:participant-joined', participant)
  })

  socket.on('room:camera-ready', (roomId) => {
    const updated = setParticipantReady(roomId, socket.id)
    if (updated) {
      io.to(roomId).emit('room:state', updated)
      io.to(roomId).emit('room:participant-ready', socket.id)
    }
  })

  socket.on('countdown:start', (roomId) => {
    const room = getRoom(roomId)
    if (!room) return

    // Any participant with camera ready can start
    const allReady = room.participants.every((p) => p.status === 'camera_ready')
    if (!allReady || room.participants.length === 0) {
      socket.emit('error', 'Not all participants are ready')
      return
    }

    setRoomPhase(roomId, 'countdown')
    io.to(roomId).emit('phase:change', 'countdown')

    // Synchronized countdown
    let secondsLeft = COUNTDOWN_SECONDS
    io.to(roomId).emit('countdown:tick', secondsLeft)

    const interval = setInterval(() => {
      secondsLeft--
      if (secondsLeft > 0) {
        io.to(roomId).emit('countdown:tick', secondsLeft)
      } else {
        clearInterval(interval)
        setRoomPhase(roomId, 'capture')
        io.to(roomId).emit('phase:change', 'capture')
        io.to(roomId).emit('countdown:capture')
      }
    }, 1000)
  })

  // Relay PeerJS ID to other participants
  socket.on('peer:announce', ({ roomId, peerId }) => {
    socket.to(roomId).emit('peer:announce', { participantId: socket.id, peerId })
  })

  socket.on('room:leave', (roomId) => {
    handleLeave(io, socket, roomId)
    currentRoomId = null
    currentParticipantId = null
  })

  socket.on('disconnect', () => {
    if (currentRoomId) {
      handleLeave(io, socket, currentRoomId)
    }
  })
}

function handleLeave(io: IO, socket: IOSocket, roomId: string): void {
  const updated = removeParticipant(roomId, socket.id)
  socket.leave(roomId)

  if (updated) {
    io.to(roomId).emit('room:state', updated)
    io.to(roomId).emit('room:participant-left', socket.id)
  }
}
