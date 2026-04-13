// ─── Room & Participants ─────────────────────────────────────────────

export type ParticipantStatus = 'waiting' | 'camera_ready' | 'disconnected'

export interface Participant {
  readonly id: string
  readonly peerId: string
  readonly name: string
  readonly slotIndex: number // 0-3
  readonly status: ParticipantStatus
  readonly isHost: boolean
}

export interface Room {
  readonly id: string
  readonly hostId: string
  readonly participants: readonly Participant[]
  readonly phase: RoomPhase
  readonly createdAt: number
}

export type RoomPhase = 'lobby' | 'countdown' | 'capture' | 'result'

// ─── Collaborative Drawing ───────────────────────────────────────────

export interface DrawStroke {
  readonly fromX: number
  readonly fromY: number
  readonly toX: number
  readonly toY: number
  readonly color: string
  readonly size: number
  readonly senderId: string
}

export interface DrawSticker {
  readonly x: number
  readonly y: number
  readonly emoji: string
  readonly size: number
  readonly senderId: string
}

export interface DrawCursor {
  readonly x: number
  readonly y: number
  readonly senderId: string
  readonly senderName: string
  readonly senderColor: string
}

export interface DrawPattern {
  readonly patternId: string
  readonly color: string
  readonly senderId: string
}

// ─── Socket.io Events ────────────────────────────────────────────────

export interface ServerToClientEvents {
  'room:state': (room: Room) => void
  'room:participant-joined': (participant: Participant) => void
  'room:participant-left': (participantId: string) => void
  'room:participant-ready': (participantId: string) => void
  'countdown:tick': (secondsLeft: number) => void
  'countdown:capture': () => void
  'phase:change': (phase: RoomPhase) => void
  'error': (message: string) => void
  // Collab draw
  'draw:stroke': (data: DrawStroke) => void
  'draw:sticker': (data: DrawSticker) => void
  'draw:cursor': (data: DrawCursor) => void
  'draw:pattern': (data: DrawPattern) => void
  'draw:clear': (senderId: string) => void
}

export interface ClientToServerEvents {
  'room:join': (payload: { roomId: string; name: string; peerId: string }) => void
  'room:leave': (roomId: string) => void
  'room:camera-ready': (roomId: string) => void
  'countdown:start': (roomId: string) => void
  // Collab draw
  'draw:stroke': (data: { roomId: string } & DrawStroke) => void
  'draw:sticker': (data: { roomId: string } & DrawSticker) => void
  'draw:cursor': (data: { roomId: string } & DrawCursor) => void
  'draw:pattern': (data: { roomId: string } & DrawPattern) => void
  'draw:clear': (data: { roomId: string; senderId: string }) => void
}

// ─── Booth Slots ─────────────────────────────────────────────────────

export const MAX_PARTICIPANTS = 4

export const SLOT_COLORS = [
  '#FF6B9D', // pink
  '#C084FC', // purple
  '#4ADE80', // green
  '#FBBF24', // yellow
] as const

export type SlotColor = (typeof SLOT_COLORS)[number]

export const CURSOR_COLORS = [
  '#FF6B9D', '#C084FC', '#4ADE80', '#FBBF24',
  '#3B82F6', '#F97316', '#06B6D4', '#F43F5E',
] as const

// ─── Capture ─────────────────────────────────────────────────────────

export interface CapturedPhoto {
  readonly participantId: string
  readonly slotIndex: number
  readonly dataUrl: string
}

export interface PhotoStripData {
  readonly roomId: string
  readonly photos: readonly CapturedPhoto[]
  readonly createdAt: number
}
