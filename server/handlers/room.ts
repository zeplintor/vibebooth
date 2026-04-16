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
  setParticipantPeerId,
  setRoomPhase,
  cancelPendingDeletion,
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
    console.log(`[room:join] socket=${socket.id} name=${name} room=${roomId}`)
    let room = getRoom(roomId)

    // Cancel any pending deletion of this room (e.g. if it went empty briefly)
    cancelPendingDeletion(roomId)

    // Create room if it doesn't exist — first joiner becomes host
    if (!room) {
      room = createRoom(roomId, socket.id)
    }

    // Dedup: if this socket is already in the room, just resync state and bail
    const existing = room.participants.find((p) => p.id === socket.id)
    if (existing) {
      console.log(`[room:join] socket=${socket.id} already in room — resending state`)
      currentRoomId = roomId
      currentParticipantId = socket.id
      socket.join(roomId)
      socket.emit('room:state', room)
      return
    }

    // Name-based dedup: if a participant with the same name already exists (from a
    // previous socket that hasn't disconnected yet), take over their slot instead
    // of adding a duplicate. This handles React remounts + reconnects cleanly.
    let reclaimedSlotIndex: number | null = null
    let reclaimedPeerId: string | null = null
    const sameName = room.participants.find((p) => p.name === name)
    if (sameName) {
      console.log(`[room:join] socket=${socket.id} reclaiming slot from old socket=${sameName.id} (name=${name}) peerId=${sameName.peerId || '(empty)'}`)
      reclaimedSlotIndex = sameName.slotIndex
      // Preserve the old peerId if the new socket didn't bring one
      if (!peerId && sameName.peerId) reclaimedPeerId = sameName.peerId
      const updated = removeParticipant(roomId, sameName.id)
      room = updated ?? getRoom(roomId) ?? room
    }

    if (room.participants.length >= MAX_PARTICIPANTS) {
      socket.emit('error', 'Room is full (4/4)')
      return
    }

    const slotIndex = reclaimedSlotIndex ?? findNextSlot(room)
    if (slotIndex === -1) {
      socket.emit('error', 'No slot available')
      return
    }

    const participant: Participant = {
      id: socket.id,
      peerId: peerId || reclaimedPeerId || '',
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

    // The initiator must be ready; others can be in any state (they just won't be captured)
    const me = room.participants.find((p) => p.id === socket.id)
    if (!me || me.status !== 'camera_ready') {
      socket.emit('error', 'Your camera is not ready yet')
      return
    }
    if (room.participants.length === 0) return

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
        // Auto-return to lobby 5s later so the next snap works
        setTimeout(() => {
          if (getRoom(roomId)) {
            setRoomPhase(roomId, 'lobby')
            io.to(roomId).emit('phase:change', 'lobby')
          }
        }, 5000)
      }
    }, 1000)
  })

  // Store peerId in room state + relay to current participants
  socket.on('peer:announce', ({ roomId, peerId }) => {
    console.log(`[peer:announce] socket=${socket.id} peerId=${peerId} room=${roomId}`)
    // Persist in state so late joiners can discover it
    const updated = setParticipantPeerId(roomId, socket.id, peerId)
    if (updated) {
      // Broadcast the FULL room state to everyone (including the announcer)
      // so they all see the updated peerId in their participants list
      io.to(roomId).emit('room:state', updated)
      // ALSO broadcast the peer:announce event so clients get the announcement immediately
      // (even if room:state hasn't fully synced yet)
      io.to(roomId).emit('peer:announce', { participantId: socket.id, peerId })
    }
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
  console.log(`[room:leave] socket=${socket.id} room=${roomId}`)
  const updated = removeParticipant(roomId, socket.id)
  socket.leave(roomId)

  if (updated) {
    io.to(roomId).emit('room:state', updated)
    io.to(roomId).emit('room:participant-left', socket.id)
  }
}
