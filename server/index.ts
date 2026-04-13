import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'
import { registerRoomHandlers } from './handlers/room'
import { registerDrawHandlers } from './handlers/draw'
import type { ServerToClientEvents, ClientToServerEvents } from '../src/types'

const dev = process.env.NODE_ENV !== 'production'
const hostname = dev ? 'localhost' : '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res)
  })

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: dev ? '*' : undefined,
    },
    path: '/api/socketio',
  })

  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket)
    registerDrawHandlers(io, socket)
  })

  httpServer.listen(port, () => {
    console.info(`> VibeBooth ready on http://${hostname}:${port}`)
  })
})
