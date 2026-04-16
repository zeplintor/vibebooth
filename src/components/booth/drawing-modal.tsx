'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useCollabDraw, type RemoteCursor } from '@/hooks/use-collab-draw'

const COLORS = [
  '#FF6B9D', '#E87AA4', '#C084FC', '#8B5CF6',
  '#4ADE80', '#22C55E', '#FBBF24', '#F97316',
  '#3B82F6', '#06B6D4', '#F43F5E', '#2D2D2D',
  '#FFFFFF', '#F5F0E8',
]

const BRUSH_SIZES = [4, 8, 16, 28]

const PATTERNS = [
  { name: '● Dots', id: 'dots' },
  { name: '▨ Stripes', id: 'stripes' },
  { name: '♥ Hearts', id: 'hearts' },
  { name: '★ Stars', id: 'stars' },
] as const

const STICKERS = [
  '💀', '✨', '🔥', '💅', '👁️', '🦋',
  '💜', '🍒', '⚡', '🌈', '👻', '🧿',
  '💋', '🪩', '🫶', '😭', '🤍', '🖤',
  '🌙', '🍄', '🧸', '🎀', '💫', '🩷',
] as const

// 9:16 format for story/vertical display
const CANVAS_W = 360
const CANVAS_H = 640

interface DrawingModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSave: (dataUrl: string) => void
  readonly roomId: string
  readonly userName: string
  readonly photos?: readonly [string, string, string]
}

export function DrawingModal({ open, onClose, onSave, roomId, userName, photos }: DrawingModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cursorLayerRef = useRef<HTMLDivElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#FF6B9D')
  const [brushSize, setBrushSize] = useState(8)
  const [mode, setMode] = useState<'draw' | 'sticker'>('draw')
  const [activeSticker, setActiveSticker] = useState('✨')
  const [stickerSize, setStickerSize] = useState(24)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const {
    myColor,
    remoteCursors,
    connected,
    emitStroke,
    emitSticker,
    emitCursor,
    emitPattern,
    emitClear,
  } = useCollabDraw({
    roomId,
    userName,
    canvasRef,
    canvasW: CANVAS_W,
    canvasH: CANVAS_H,
  })

  // Init canvas with background and photos
  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#F5F0E8'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      // Draw photos if provided
      if (photos && photos.length === 3) {
        const photoH = 120 // height of each photo
        const photoW = 120 // width of each photo
        const startY = 80 // start position for first photo
        const gap = 20

        try {
          for (let i = 0; i < 3; i++) {
            const img = await loadImage(photos[i])
            const y = startY + i * (photoH + gap)
            // Center horizontally
            const x = (CANVAS_W - photoW) / 2
            ctx.save()
            ctx.beginPath()
            ctx.roundRect(x, y, photoW, photoH, 8)
            ctx.clip()
            // Cover-fit the image
            const scale = Math.max(photoW / img.width, photoH / img.height)
            const sw = img.width * scale
            const sh = img.height * scale
            ctx.drawImage(img, x + (photoW - sw) / 2, y + (photoH - sh) / 2, sw, sh)
            ctx.restore()
            // Border
            ctx.strokeStyle = '#8B5E3C'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.roundRect(x, y, photoW, photoH, 8)
            ctx.stroke()
          }
        } catch (err) {
          console.error('Failed to draw photos on canvas:', err)
        }
      }
    }, 50)
    return () => clearTimeout(t)
  }, [open, photos])

  // Listen for remote pattern fills
  useEffect(() => {
    function handleRemotePattern(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail) {
        fillPatternOnCanvas(detail.patternId, detail.color)
      }
    }
    window.addEventListener('collab:pattern', handleRemotePattern)
    return () => window.removeEventListener('collab:pattern', handleRemotePattern)
  }, [])

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }, [])

  // Emit cursor position on move (throttled)
  const lastCursorEmit = useRef(0)
  function handleCursorMove(e: React.MouseEvent | React.TouchEvent) {
    const now = Date.now()
    if (now - lastCursorEmit.current < 50) return // throttle to 20fps
    lastCursorEmit.current = now
    const pos = getPos(e)
    emitCursor(pos.x, pos.y)
  }

  function stampSticker(e: React.MouseEvent | React.TouchEvent) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.font = `${stickerSize}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(activeSticker, pos.x, pos.y)
    emitSticker({ x: pos.x, y: pos.y, emoji: activeSticker, size: stickerSize })
  }

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    handleCursorMove(e)
    if (mode === 'sticker') {
      stampSticker(e)
      return
    }
    setIsDrawing(true)
    lastPos.current = getPos(e)
  }, [getPos, mode, activeSticker, stickerSize, emitSticker])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    handleCursorMove(e)
    if (mode === 'sticker') return
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !lastPos.current) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    emitStroke({
      fromX: lastPos.current.x,
      fromY: lastPos.current.y,
      toX: pos.x,
      toY: pos.y,
      color,
      size: brushSize,
    })
    lastPos.current = pos
  }, [isDrawing, color, brushSize, getPos, mode, emitStroke])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
    lastPos.current = null
  }, [])

  function fillPatternOnCanvas(patternId: string, patternColor: string) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#F5F0E8'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    if (patternId === 'dots') {
      for (let y = 0; y < CANVAS_H; y += 20) {
        for (let x = 0; x < CANVAS_W; x += 20) {
          ctx.beginPath()
          ctx.arc(x + 10, y + 10, 4, 0, Math.PI * 2)
          ctx.fillStyle = patternColor
          ctx.fill()
        }
      }
    } else if (patternId === 'stripes') {
      ctx.strokeStyle = patternColor
      ctx.lineWidth = 6
      for (let i = -CANVAS_H; i < CANVAS_W + CANVAS_H; i += 18) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i - CANVAS_H, CANVAS_H)
        ctx.stroke()
      }
    } else if (patternId === 'hearts') {
      ctx.fillStyle = patternColor
      ctx.font = '24px serif'
      for (let y = 0; y < CANVAS_H; y += 36) {
        for (let x = 0; x < CANVAS_W; x += 40) {
          ctx.fillText('\u2665', x + ((y / 36) % 2 === 0 ? 0 : 20), y + 28)
        }
      }
    } else if (patternId === 'stars') {
      ctx.fillStyle = patternColor
      ctx.font = '20px serif'
      for (let y = 0; y < CANVAS_H; y += 32) {
        for (let x = 0; x < CANVAS_W; x += 36) {
          ctx.fillText('\u2605', x + ((y / 32) % 2 === 0 ? 0 : 18), y + 24)
        }
      }
    }
  }

  function handleFillPattern(patternId: string) {
    fillPatternOnCanvas(patternId, color)
    emitPattern(patternId, color)
  }

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#F5F0E8'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    emitClear()
  }

  function handleSave() {
    const canvas = canvasRef.current
    if (!canvas) return
    onSave(canvas.toDataURL('image/png'))
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div className="card-sketch bg-white p-4 max-w-2xl w-full max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-[family-name:var(--font-hand)] text-2xl font-bold text-vb-ink">
              Draw Together
            </h2>
            {connected ? (
              <span className="flex items-center gap-1 text-xs font-[family-name:var(--font-display)] text-emerald-500">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                live
              </span>
            ) : (
              <span className="text-xs font-[family-name:var(--font-display)] text-gray-400">
                solo mode
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 md:w-7 md:h-7 flex items-center justify-center rounded-full border-2 border-vb-ink text-vb-ink hover:bg-gray-100 text-sm font-bold"
          >
            x
          </button>
        </div>

        {/* Body: canvas top on mobile, left on desktop */}
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 flex-1 min-h-0">
          {/* Canvas with cursor overlay */}
          <div className="relative shrink-0 md:h-full w-full md:w-auto" style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, height: 'auto', maxHeight: 'clamp(200px, 40vh, 100%)' }}>
            <div
              className="border-3 border-vb-ink rounded-lg overflow-hidden cursor-crosshair touch-none w-full h-full"
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="w-full h-full"
                onMouseDown={startDrawing}
                onMouseMove={(e) => { draw(e); handleCursorMove(e) }}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={(e) => { draw(e); handleCursorMove(e) }}
                onTouchEnd={stopDrawing}
              />
            </div>

            {/* Remote cursors overlay */}
            <div ref={cursorLayerRef} className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
              {Array.from(remoteCursors.entries()).map(([id, cursor]) => (
                <RemoteCursorBubble key={id} cursor={cursor} canvasW={CANVAS_W} canvasH={CANVAS_H} />
              ))}
            </div>

            {/* My color indicator */}
            <div
              className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: myColor }}
              title="Your color"
            />
          </div>

          {/* Tools panel */}
          <div className="flex flex-col gap-3 flex-1 min-w-0 justify-between overflow-y-auto">
            {/* Mode toggle */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setMode('draw')}
                className={`flex-1 md:py-1.5 py-2 rounded-lg text-xs font-semibold font-[family-name:var(--font-display)] border-2 transition-colors ${
                  mode === 'draw' ? 'bg-vb-ink text-white border-vb-ink' : 'bg-white text-vb-ink border-gray-300'
                }`}
              >
                🖌️ Draw
              </button>
              <button
                onClick={() => setMode('sticker')}
                className={`flex-1 md:py-1.5 py-2 rounded-lg text-xs font-semibold font-[family-name:var(--font-display)] border-2 transition-colors ${
                  mode === 'sticker' ? 'bg-vb-ink text-white border-vb-ink' : 'bg-white text-vb-ink border-gray-300'
                }`}
              >
                ✨ Stickers
              </button>
            </div>

            {mode === 'draw' ? (
              <>
                <div>
                  <p className="font-[family-name:var(--font-hand)] text-sm text-gray-500 mb-2">Colors</p>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-10 h-10 md:w-6 md:h-6 rounded-full border-2 transition-transform ${
                          color === c ? 'border-vb-ink scale-110' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-[family-name:var(--font-hand)] text-sm text-gray-500 mb-2">Brush</p>
                  <div className="flex gap-3 items-center">
                    {BRUSH_SIZES.map((size) => (
                      <button
                        key={size}
                        onClick={() => setBrushSize(size)}
                        className={`rounded-full bg-vb-ink transition-transform md:scale-100 scale-110 ${
                          brushSize === size ? 'ring-2 ring-vb-pink ring-offset-1 scale-125 md:scale-110' : ''
                        }`}
                        style={{ width: Math.max(size + 8, 40), height: Math.max(size + 8, 40) }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-[family-name:var(--font-hand)] text-sm text-gray-500 mb-2">Patterns</p>
                  <div className="grid md:grid-cols-2 grid-cols-2 gap-2">
                    {PATTERNS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleFillPattern(p.id)}
                        className="btn-sketch md:!py-1 md:!px-2 !py-2 !px-3 !text-xs bg-white text-vb-ink !border-2 !shadow-[2px_2px_0_var(--vb-border)]"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="font-[family-name:var(--font-hand)] text-sm text-gray-500 mb-2">Tap to place</p>
                  <div className="grid grid-cols-6 md:grid-cols-4 gap-2">
                    {STICKERS.map((s, i) => (
                      <button
                        key={`${s}-${i}`}
                        onClick={() => setActiveSticker(s)}
                        className={`w-11 h-11 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-xl md:text-lg transition-transform ${
                          activeSticker === s ? 'bg-vb-pink/20 scale-110 ring-2 ring-vb-pink' : 'hover:bg-gray-100'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-[family-name:var(--font-hand)] text-sm text-gray-500 mb-2">Size</p>
                  <div className="flex gap-3 items-center">
                    {[16, 24, 36, 48].map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setStickerSize(sz)}
                        className={`w-11 h-11 md:w-8 md:h-8 flex items-center justify-center rounded-lg border-2 text-xs font-[family-name:var(--font-display)] transition-colors ${
                          stickerSize === sz ? 'border-vb-ink bg-vb-ink text-white' : 'border-gray-300 text-gray-500'
                        }`}
                      >
                        {sz === 16 ? 'S' : sz === 24 ? 'M' : sz === 36 ? 'L' : 'XL'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Online users indicator */}
            {remoteCursors.size > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-gray-400 font-[family-name:var(--font-display)]">Drawing:</span>
                {Array.from(remoteCursors.values()).map((c, i) => (
                  <span
                    key={i}
                    className="text-xs font-[family-name:var(--font-hand)] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 shrink-0">
              <button onClick={clearCanvas} className="btn-sketch md:!py-1.5 md:!px-3 !py-2 !px-4 bg-gray-100 text-vb-ink !text-xs !border-2 !shadow-[2px_2px_0_var(--vb-border)] flex-1">
                Clear
              </button>
              <button onClick={handleSave} className="btn-sketch md:!py-1.5 md:!px-3 !py-2 !px-4 bg-vb-pink text-white !text-xs !border-2 !shadow-[2px_2px_0_var(--vb-border)] flex-1">
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * A floating cursor bubble showing another user's position on the canvas.
 * Shows their name + a colored dot, with smooth CSS transitions.
 */
function RemoteCursorBubble({
  cursor,
  canvasW,
  canvasH,
}: {
  cursor: RemoteCursor
  canvasW: number
  canvasH: number
}) {
  // Convert canvas coordinates to percentage positions
  const leftPct = (cursor.x / canvasW) * 100
  const topPct = (cursor.y / canvasH) * 100

  return (
    <div
      className="absolute transition-all duration-100 ease-out"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {/* Cursor dot */}
      <div
        className="w-3 h-3 rounded-full border-2 border-white shadow-md"
        style={{ backgroundColor: cursor.color }}
      />
      {/* Name label */}
      <div
        className="absolute left-3 -top-1 whitespace-nowrap px-1.5 py-0.5 rounded-full text-white text-[10px] font-[family-name:var(--font-hand)] font-bold shadow-sm"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.name}
      </div>
    </div>
  )
}

export default DrawingModal
