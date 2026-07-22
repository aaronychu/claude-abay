import type { DesktopHostPlatform } from '../src/lib/desktopHost/types'

type ElectronPreloadProcess = NodeJS.Process & {
  getSystemVersion?: () => string
}

export function detectDesktopHostPlatform(
  platform = process.platform,
  release = (process as ElectronPreloadProcess).getSystemVersion?.() ?? '',
): DesktopHostPlatform {
  if (platform === 'darwin') return { os: 'macos', windowsBuild: null }
  if (platform === 'linux') return { os: 'linux', windowsBuild: null }
  if (platform !== 'win32') return { os: 'unknown', windowsBuild: null }

  const build = Number.parseInt(release.split('.')[2] ?? '', 10)
  return { os: 'windows', windowsBuild: Number.isFinite(build) ? build : null }
}
