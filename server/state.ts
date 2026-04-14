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

export function removeParticipant(roomId: string, participantId: string): Room | undefined {
  const room = rooms.get(roomId)
  if (!room) return undefined

  const updated: Room = {
    ...room,
    participants: room.participants.filter((p) => p.id !== participantId),
  }

  if (updated.participants.length === 0) {
    rooms.delete(roomId)
    return undefined
  }

  rooms.set(roomId, updated)
  return updated
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
