'use client'

import { useEffect, useRef, useState } from 'react'

interface ResultViewProps {
  readonly photos: readonly [string, string, string]
  readonly backgroundUrl?: string | null
  readonly onRetake: () => void
  readonly roomId?: string
}

const STRIP_W = 440
const STRIP_H = 1240
const FRAME_W = 360
const FRAME_H = 350
const PAD = 20
const FRAME_PAD = 40

/**
 * Result page: renders the final photo strip on a canvas and
 * provides a download button.
 */
export function ResultView({ photos, backgroundUrl, onRetake, roomId }: ResultViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    renderStrip()
  }, [photos, backgroundUrl])

  async function renderStrip() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = STRIP_W
    canvas.height = STRIP_H

    // Background
    if (backgroundUrl) {
      const bgImg = await loadImage(backgroundUrl)
      ctx.drawImage(bgImg, 0, 0, STRIP_W, STRIP_H)
    } else {
      // Leopard-ish pattern fallback: cream + colored dots
      ctx.fillStyle = '#F5F0E8'
      ctx.fillRect(0, 0, STRIP_W, STRIP_H)
      drawLeopardPattern(ctx, STRIP_W, STRIP_H)
    }

    // Rounded border
    ctx.strokeStyle = '#8B5E3C'
    ctx.lineWidth = 4
    roundedRect(ctx, 2, 2, STRIP_W - 4, STRIP_H - 4, 20)
    ctx.stroke()

    // Draw each photo frame
    for (let i = 0; i < 3; i++) {
      const x = FRAME_PAD
      const y = FRAME_PAD + i * (FRAME_H + PAD)

      // White frame background
      ctx.fillStyle = 'white'
      roundedRect(ctx, x - 4, y - 4, FRAME_W + 8, FRAME_H + 8, 8)
      ctx.fill()

      // Sketchy border
      ctx.strokeStyle = '#6B7280'
      ctx.lineWidth = 3
      drawSketchyRect(ctx, x - 6, y - 6, FRAME_W + 12, FRAME_H + 12)

      // Photo
      const img = await loadImage(photos[i])
      ctx.save()
      roundedRect(ctx, x, y, FRAME_W, FRAME_H, 6)
      ctx.clip()
      // Cover-fit the image
      const scale = Math.max(FRAME_W / img.width, FRAME_H / img.height)
      const sw = img.width * scale
      const sh = img.height * scale
      ctx.drawImage(img, x + (FRAME_W - sw) / 2, y + (FRAME_H - sh) / 2, sw, sh)
      ctx.restore()
    }

    // Footer branding
    ctx.fillStyle = '#FF6B9D'
    ctx.font = 'bold 36px Caveat, cursive'
    ctx.textAlign = 'center'
    ctx.fillText('VibeBooth', STRIP_W / 2, STRIP_H - 30)

    setDownloadUrl(canvas.toDataURL('image/png'))
  }

  function handleDownload() {
    if (!downloadUrl) return
    const link = document.createElement('a')
    link.download = 'vibebooth-strip.png'
    link.href = downloadUrl
    link.click()
  }

  const shareText = 'Just vibed with my crew on VibeBooth! 📸✨'
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${roomId ?? ''}`
    : ''

  function handleCopyLink() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleNativeShare() {
    if (!downloadUrl) return
    try {
      const blob = await (await fetch(downloadUrl)).blob()
      const file = new File([blob], 'vibebooth-strip.png', { type: 'image/png' })
      await navigator.share({ text: shareText, files: [file] })
    } catch {
      // Fallback: just share the link
      try { await navigator.share({ text: shareText, url: shareUrl }) } catch { /* user cancelled */ }
    }
  }

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <div className="flex flex-col items-center h-full min-h-0">
      <h2 className="font-[family-name:var(--font-hand)] text-3xl font-bold text-vb-ink shrink-0 mb-2">
        Your Photo Strip!
      </h2>

      <div className="relative flex-1 min-h-0 flex items-center justify-center" style={{ transform: 'rotate(-2deg)' }}>
        <canvas
          ref={canvasRef}
          className="rounded-xl shadow-xl max-h-full w-auto"
        />
      </div>

      {/* Actions row */}
      <div className="flex gap-3 shrink-0 mt-4 flex-wrap justify-center">
        <button onClick={onRetake} className="btn-sketch bg-white text-vb-ink md:!py-1.5 md:!px-3 !py-2 !px-4 !text-xs !border-2 !shadow-[3px_3px_0_var(--vb-border)] min-w-fit">
          Retake
        </button>
        <button onClick={handleDownload} disabled={!downloadUrl} className="btn-sketch bg-vb-pink text-white md:!py-1.5 md:!px-3 !py-2 !px-4 !text-xs !border-2 !shadow-[3px_3px_0_var(--vb-border)] min-w-fit">
          Download
        </button>
      </div>

      {/* Share row */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-2 shrink-0 mt-4 justify-center items-center w-full">
        <span className="font-[family-name:var(--font-hand)] text-gray-400 text-sm md:flex-shrink-0">Share:</span>

        <div className="flex gap-3 md:gap-2 justify-center items-center flex-wrap w-full md:w-auto">
          {/* Native share (mobile) */}
          {canNativeShare && (
            <button onClick={handleNativeShare} className="share-btn w-11 h-11 md:w-9 md:h-9" title="Share">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-4 md:h-4">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
          )}

          {/* WhatsApp */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="share-btn share-btn-whatsapp w-11 h-11 md:w-9 md:h-9 flex items-center justify-center"
            title="WhatsApp"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="md:w-4 md:h-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>

          {/* X / Twitter */}
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="share-btn share-btn-x w-11 h-11 md:w-9 md:h-9 flex items-center justify-center"
            title="X"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="md:w-3.5 md:h-3.5">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          {/* Save to phone (Insta / TikTok / Snapchat) */}
          <button
            onClick={handleDownload}
            className="share-btn flex items-center justify-center gap-1 md:gap-1.5 !px-3 !py-2 md:!py-1.5 !rounded-full font-[family-name:var(--font-display)] text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 w-full md:w-auto md:flex-shrink-0"
            title="Save photo to share on Insta, TikTok or Snapchat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="md:hidden">Save</span>
            <span className="hidden md:inline">Save for Insta / TikTok</span>
          </button>

          {/* Copy link */}
          <button onClick={handleCopyLink} className="share-btn w-11 h-11 md:w-9 md:h-9 flex items-center justify-center" title="Copy link">
            {copied ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="md:w-4 md:h-4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-4 md:h-4">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
          </button>
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

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
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
  x: number, y: number, w: number, h: number
) {
  const j = () => (Math.random() - 0.5) * 3
  ctx.beginPath()
  ctx.moveTo(x + j(), y + j())
  ctx.lineTo(x + w + j(), y + j())
  ctx.lineTo(x + w + j(), y + h + j())
  ctx.lineTo(x + j(), y + h + j())
  ctx.closePath()
  ctx.stroke()
}

function drawLeopardPattern(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const spots = [
    { x: 0.08, y: 0.05, rx: 18, ry: 12, color: '#E87AA4' },
    { x: 0.85, y: 0.03, rx: 14, ry: 10, color: '#8B5E3C' },
    { x: 0.05, y: 0.15, rx: 16, ry: 11, color: '#D4739A' },
    { x: 0.9, y: 0.12, rx: 20, ry: 13, color: '#E87AA4' },
    { x: 0.07, y: 0.32, rx: 15, ry: 10, color: '#8B5E3C' },
    { x: 0.88, y: 0.28, rx: 18, ry: 12, color: '#E87AA4' },
    { x: 0.04, y: 0.45, rx: 17, ry: 11, color: '#D4739A' },
    { x: 0.92, y: 0.42, rx: 14, ry: 10, color: '#8B5E3C' },
    { x: 0.06, y: 0.58, rx: 19, ry: 13, color: '#E87AA4' },
    { x: 0.87, y: 0.55, rx: 16, ry: 11, color: '#D4739A' },
    { x: 0.05, y: 0.72, rx: 15, ry: 10, color: '#8B5E3C' },
    { x: 0.9, y: 0.68, rx: 18, ry: 12, color: '#E87AA4' },
    { x: 0.08, y: 0.85, rx: 17, ry: 11, color: '#D4739A' },
    { x: 0.88, y: 0.82, rx: 14, ry: 10, color: '#E87AA4' },
    { x: 0.06, y: 0.95, rx: 16, ry: 11, color: '#8B5E3C' },
    { x: 0.91, y: 0.93, rx: 19, ry: 13, color: '#D4739A' },
  ]

  for (const spot of spots) {
    // Brown outline
    ctx.beginPath()
    ctx.ellipse(spot.x * w, spot.y * h, spot.rx + 4, spot.ry + 3, 0.3, 0, Math.PI * 2)
    ctx.strokeStyle = '#8B5E3C'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Colored fill
    ctx.beginPath()
    ctx.ellipse(spot.x * w, spot.y * h, spot.rx, spot.ry, 0.3, 0, Math.PI * 2)
    ctx.fillStyle = spot.color
    ctx.fill()
  }
}

export default ResultView
