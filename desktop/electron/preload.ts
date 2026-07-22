import { contextBridge, ipcRenderer } from 'electron'
import os from 'node:os'
import { createElectronHost } from '../src/lib/desktopHost/electronHost'
import type { DesktopHostPlatform, DesktopHostUnlisten } from '../src/lib/desktopHost/types'
import type { ElectronEventChannel, ElectronIpcChannel } from './ipc/channels'

function detectDesktopHostPlatform(platform = process.platform, release = os.release()): DesktopHostPlatform {
  if (platform === 'darwin') return { os: 'macos', windowsBuild: null }
  if (platform === 'linux') return { os: 'linux', windowsBuild: null }
  if (platform !== 'win32') return { os: 'unknown', windowsBuild: null }

  const build = Number.parseInt(release.split('.')[2] ?? '', 10)
  return { os: 'windows', windowsBuild: Number.isFinite(build) ? build : null }
}

const electronHost = createElectronHost({
  invoke<T>(channel: ElectronIpcChannel, payload?: unknown): Promise<T> {
    return ipcRenderer.invoke(channel, payload) as Promise<T>
  },
  subscribe<T>(
    channel: ElectronEventChannel,
    handler: (payload: T) => void,
  ): Promise<DesktopHostUnlisten> {
    const listener = (_event: Electron.IpcRendererEvent, payload: T) => handler(payload)
    ipcRenderer.on(channel, listener)
    return Promise.resolve(() => {
      ipcRenderer.removeListener(channel, listener)
    })
  },
}, detectDesktopHostPlatform())

contextBridge.exposeInMainWorld('desktopHost', electronHost)

export { detectDesktopHostPlatform }
