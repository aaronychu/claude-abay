import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectDesktopHostPlatform } from './preloadPlatform'

describe('Electron preload bridge', () => {
  it('detects Windows desktop builds without Node built-in modules', () => {
    expect(detectDesktopHostPlatform('win32', '10.0.19045')).toEqual({
      os: 'windows',
      windowsBuild: 19045,
    })
    expect(detectDesktopHostPlatform('win32', '10.0.22631')).toEqual({
      os: 'windows',
      windowsBuild: 22631,
    })
    expect(detectDesktopHostPlatform('win32', '')).toEqual({
      os: 'windows',
      windowsBuild: null,
    })
  })

  it('keeps packaged preload free of node:os imports', () => {
    const source = readFileSync(path.join(process.cwd(), 'electron', 'preload.ts'), 'utf-8')

    expect(source).not.toContain('node:os')
  })
})
