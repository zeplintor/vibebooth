import type { Room, Participant, RoomPhase } from '../src/types'

// In-memory room store (swap for Redis in production)
const rooms = new Map<string, Room>()

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId)
}

export function createRoom(roomId: string, hostId: string): Room {
  const room: Room = {
    id: roomId,
    hostId,
    participants: [],
    phase: 'lobby',
    createdAt: Date.now(),
  }
  rooms.set(roomId, room)
  return room
}

export function addParticipant(roomId: string, participant: Participant): Room | undefined {
  const room = rooms.get(roomId)
  if (!room) return undefined

  const updated: Room = {
    ...room,
    participants: [...room.participants, participant],
  }
  rooms.set(roomId, updated)
  return updated
}

const EMPTY_ROOM_TTL_MS = 30_000
const pendingDeletions = new Map<string, NodeJS.Timeout>()

export function removeParticipant(roomId: string, participantId: string): Room | undefined {
  const room = rooms.get(roomId)
  if (!room) return undefined

  const updated: Room = {
    ...room,
    participants: room.participants.filter((p) => p.id !== participantId),
  }

  rooms.set(roomId, updated)

  // Don't delete empty rooms immediately — wait 30s to survive React remounts
  // and client reconnections. If someone rejoins within that window, cancel the deletion.
  if (updated.participants.length === 0) {
    const existing = pendingDeletions.get(roomId)
    if (existing) clearTimeout(existing)
    const timeout = setTimeout(() => {
      const current = rooms.get(roomId)
      if (current && current.participants.length === 0) {
        rooms.delete(roomId)
      }
      pendingDeletions.delete(roomId)
    }, EMPTY_ROOM_TTL_MS)
    pendingDeletions.set(roomId, timeout)
    return undefined
  }

  return updated
}

export function cancelPendingDeletion(roomId: string): void {
  const existing = pendingDeletions.get(roomId)
  if (existing) {
    clearTimeout(existing)
    pendingDeletions.delete(roomId)
  }
}

export function setParticipantPeerId(roomId: string, participantId: string, peerId: string): Room | undefined {
  const room = rooms.get(roomId)
  if (!room) return undefined

  const updated: Room = {
    ...room,
    participants: room.participants.map((p) =>
      p.id === participantId ? { ...p, peerId } : p
    ),
  }
  rooms.set(roomId, updated)
  return updated
}

export function setParticipantReady(roomId: string, participantId: string): Room | undefined {
  const room = rooms.get(roomId)
  if (!room) return undefined

  const updated: Room = {
    ...room,
    participants: room.participants.map((p) =>
      p.id === participantId ? { ...p, status: 'camera_ready' as const } : p
    ),
  }
  rooms.set(roomId, updated)
  return updated
}

export function setRoomPhase(roomId: string, phase: RoomPhase): Room | undefined {
  const room = rooms.get(roomId)
  if (!room) return undefined

  const updated: Room = { ...room, phase }
  rooms.set(roomId, updated)
  return updated
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId)
}
