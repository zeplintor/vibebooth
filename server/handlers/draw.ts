import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '../../src/types'

type IO = Server<ClientToServerEvents, ServerToClientEvents>
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>

/**
 * Relay-only handlers for collaborative drawing.
 * The server doesn't store any canvas state — it just
 * broadcasts draw events to all other participants in the room.
 */
export function registerDrawHandlers(io: IO, socket: IOSocket): void {
  socket.on('draw:stroke', (data) => {
    socket.to(data.roomId).emit('draw:stroke', data)
  })

  socket.on('draw:sticker', (data) => {
    socket.to(data.roomId).emit('draw:sticker', data)
  })

  socket.on('draw:cursor', (data) => {
    socket.to(data.roomId).emit('draw:cursor', data)
  })

  socket.on('draw:pattern', (data) => {
    socket.to(data.roomId).emit('draw:pattern', data)
  })

  socket.on('draw:clear', (data) => {
    socket.to(data.roomId).emit('draw:clear', data.senderId)
  })
}
