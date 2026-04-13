'use client'

import { type ReactNode } from 'react'

interface PhotoStripProps {
  readonly frames: readonly [ReactNode, ReactNode, ReactNode]
  readonly rotation?: number
  readonly backgroundUrl?: string | null
}

const STRIP_W = 220
const STRIP_H = 620
const FRAME_X = 20
const FRAME_W = 180
const FRAME_H = 175
const FRAME_GAP = 200

/**
 * Vertical photo strip that scales to fit the viewport.
 * Uses viewBox so the SVG + overlays scale together.
 */
export function PhotoStrip({ frames, rotation = -3, backgroundUrl }: PhotoStripProps) {
  return (
    <div
      className="relative shrink-0"
      style={{
        transform: `rotate(${rotation}deg)`,
        // Scale the strip to fit viewport: strip + header + button ≈ 85vh max
        height: 'min(72vh, 520px)',
        aspectRatio: `${STRIP_W} / ${STRIP_H}`,
      }}
    >
      {/* Strip body — scales via viewBox */}
      <svg
        viewBox={`0 0 ${STRIP_W} ${STRIP_H}`}
        className="w-full h-full drop-shadow-lg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="sketchy">
            <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <clipPath id="stripClip">
            <rect x="0" y="0" width={STRIP_W} height={STRIP_H} rx="12" ry="12" />
          </clipPath>
        </defs>

        <g clipPath="url(#stripClip)">
          {backgroundUrl ? (
            <image href={backgroundUrl} x="0" y="0" width={STRIP_W} height={STRIP_H} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect x="0" y="0" width={STRIP_W} height={STRIP_H} fill="url(#leopard)" />
          )}
        </g>

        <rect x="0" y="0" width={STRIP_W} height={STRIP_H} rx="12" ry="12" fill="none" stroke="#8B5E3C" strokeWidth="2" />

        {[0, 1, 2].map((i) => {
          const y = FRAME_X + i * FRAME_GAP
          return (
            <g key={i}>
              <rect x={FRAME_X} y={y} width={FRAME_W} height={FRAME_H} rx="4" fill="white" />
              <rect x={FRAME_X - 2} y={y - 2} width={FRAME_W + 4} height={FRAME_H + 4} rx="6"
                fill="none" stroke="#6B7280" strokeWidth="2.5" style={{ filter: 'url(#sketchy)' }} />
            </g>
          )
        })}
      </svg>

      {/* Overlay: React content scaled to match SVG */}
      <div className="absolute inset-0">
        {frames.map((frame, i) => (
          <div
            key={i}
            className="absolute overflow-hidden rounded"
            style={{
              left: `${(FRAME_X / STRIP_W) * 100}%`,
              top: `${((FRAME_X + i * FRAME_GAP) / STRIP_H) * 100}%`,
              width: `${(FRAME_W / STRIP_W) * 100}%`,
              height: `${(FRAME_H / STRIP_H) * 100}%`,
            }}
          >
            {frame}
          </div>
        ))}
      </div>
    </div>
  )
}

export default PhotoStrip
