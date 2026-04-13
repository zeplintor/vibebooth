import Peer from 'peerjs'

let peerInstance: Peer | null = null

export interface PeerConfig {
  readonly host: string
  readonly port: number
  readonly path: string
  readonly secure: boolean
}

const DEFAULT_CONFIG: PeerConfig = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
}

export function createPeer(customId?: string): Peer {
  if (peerInstance && !peerInstance.destroyed) {
    return peerInstance
  }

  const config = DEFAULT_CONFIG

  peerInstance = customId
    ? new Peer(customId, {
        host: config.host,
        port: config.port,
        path: config.path,
        secure: config.secure,
      })
    : new Peer({
        host: config.host,
        port: config.port,
        path: config.path,
        secure: config.secure,
      })

  return peerInstance
}

export function getPeer(): Peer | null {
  return peerInstance
}

export function destroyPeer(): void {
  if (peerInstance && !peerInstance.destroyed) {
    peerInstance.destroy()
  }
  peerInstance = null
}
