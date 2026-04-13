import type { CapturedPhoto } from '@/types'

const STRIP_WIDTH = 400
const PHOTO_HEIGHT = 300
const PADDING = 20
const BORDER_RADIUS = 12

export function captureVideoFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')

  ctx.drawImage(video, 0, 0)
  return canvas.toDataURL('image/png')
}

export async function generatePhotoStrip(photos: readonly CapturedPhoto[]): Promise<string> {
  const sorted = [...photos].sort((a, b) => a.slotIndex - b.slotIndex)

  const totalHeight =
    PADDING * 2 + sorted.length * PHOTO_HEIGHT + (sorted.length - 1) * PADDING + 60

  const canvas = document.createElement('canvas')
  canvas.width = STRIP_WIDTH
  canvas.height = totalHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')

  // Background — white with slight rotation feel
  ctx.fillStyle = '#FFFDF7'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Sketchy border
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 3
  ctx.setLineDash([8, 4])
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16)
  ctx.setLineDash([])

  // Load and draw each photo
  let y = PADDING
  for (const photo of sorted) {
    const img = await loadImage(photo.dataUrl)
    const x = PADDING

    // Sketchy photo frame
    ctx.save()
    ctx.strokeStyle = '#555'
    ctx.lineWidth = 2
    drawSketchyRect(ctx, x - 4, y - 4, STRIP_WIDTH - PADDING * 2 + 8, PHOTO_HEIGHT + 8)
    ctx.restore()

    // Clip and draw image
    ctx.save()
    roundedRect(ctx, x, y, STRIP_WIDTH - PADDING * 2, PHOTO_HEIGHT, BORDER_RADIUS)
    ctx.clip()
    ctx.drawImage(img, x, y, STRIP_WIDTH - PADDING * 2, PHOTO_HEIGHT)
    ctx.restore()

    y += PHOTO_HEIGHT + PADDING
  }

  // Footer text
  ctx.fillStyle = '#FF6B9D'
  ctx.font = 'bold 22px "Comic Sans MS", cursive'
  ctx.textAlign = 'center'
  ctx.fillText('VibeBooth ✨', canvas.width / 2, y + 20)

  return canvas.toDataURL('image/png')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawSketchyRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const jitter = () => (Math.random() - 0.5) * 3

  ctx.beginPath()
  ctx.moveTo(x + jitter(), y + jitter())
  ctx.lineTo(x + w + jitter(), y + jitter())
  ctx.lineTo(x + w + jitter(), y + h + jitter())
  ctx.lineTo(x + jitter(), y + h + jitter())
  ctx.closePath()
  ctx.stroke()
}
