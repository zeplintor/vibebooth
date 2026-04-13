# VibeBooth

Virtual photobooth for 4 friends. See each other live via WebRTC, do a synchronized countdown, and generate a classic photo strip.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Real-time sync | Socket.io (rooms, countdown) |
| Video | PeerJS (WebRTC peer-to-peer) |
| Image generation | HTML Canvas API |
| Fonts | Caveat (handwritten), Fredoka (display) |

## Project Structure

```
server/
  index.ts              # Custom HTTP server: Next.js + Socket.io on same port
  state.ts              # In-memory room state (immutable updates)
  handlers/
    room.ts             # Socket.io events: join, leave, camera-ready, countdown

src/
  types/index.ts        # Shared types: Room, Participant, Socket events, constants
  lib/
    socket.ts           # Socket.io client singleton (typed)
    peer.ts             # PeerJS client singleton (cloud relay)
    canvas.ts           # captureVideoFrame() + generatePhotoStrip()
  components/
    booth/
      leopard-pattern.tsx     # SVG <pattern> for the strip border
      photo-strip.tsx         # Tilted vertical strip with 3 sketchy frames
      placeholder-scene.tsx   # SVG landscape placeholder for empty frames
      claim-booth.tsx         # "Claim Your Booth" dots indicator (0-4)
      snap-button.tsx         # Purple pill button + camera icon
      draw-background-label.tsx  # Decorative label + paintbrush
  app/
    globals.css         # Theme: dotted bg, sketch buttons/cards, animations
    layout.tsx          # Root layout with VibeBooth header
    page.tsx            # Home: "Create a Booth" -> generates room ID
    [roomId]/
      page.tsx          # Lobby: strip + claim booth + snap button
```

## Getting Started

```bash
npm install
npm run dev        # Custom server (Next.js + Socket.io together)
```

Open http://localhost:3000

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start custom server (Next.js + Socket.io on port 3000) |
| `npm run dev:next` | Start Next.js only (no Socket.io) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

## Design

Style: **cartoon-sketch** with hand-drawn borders, leopard print pattern, bright colors.

- Leopard print: pink/brown SVG pattern on photo strip border
- Sketchy frames: SVG displacement filter for wobbly borders
- Strip tilted at -3 degrees
- Color palette: `#FF6B9D` (pink), `#C084FC` (purple), `#4ADE80` (green), `#FBBF24` (yellow)
- Background: cream `#FFFDF7` with dot grid

## App Flow

1. **Home** (`/`) -- Create a booth, get a unique room ID
2. **Lobby** (`/:roomId`) -- Share link, 4 friends join, enable cameras
3. **Countdown** -- Host clicks "Snap", synchronized 3-2-1 across all screens
4. **Capture** -- Canvas API grabs a frame from each video stream
5. **Result** -- Vertical photo strip with download button

## Socket.io Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `room:join` | Client -> Server | `{ roomId, name, peerId }` |
| `room:leave` | Client -> Server | `roomId` |
| `room:camera-ready` | Client -> Server | `roomId` |
| `countdown:start` | Client -> Server | `roomId` (host only) |
| `room:state` | Server -> Client | `Room` object |
| `countdown:tick` | Server -> Client | `secondsLeft` |
| `countdown:capture` | Server -> Client | (no payload) |
| `phase:change` | Server -> Client | `RoomPhase` |
