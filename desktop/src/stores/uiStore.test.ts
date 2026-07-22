import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('uiStore theme handling', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
    delete window.desktopHost
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  it('defaults new installs to the pure white theme', async () => {
    const { initializeTheme, useUIStore } = await import('./uiStore')

    expect(useUIStore.getState().theme).toBe('white')
    initializeTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('white')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('hydrates and applies the pure white theme as a light color scheme', async () => {
    window.localStorage.setItem('claude-abay-theme', 'white')

    const { initializeTheme, useUIStore } = await import('./uiStore')

    expect(useUIStore.getState().theme).toBe('white')
    initializeTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('white')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('cycles through pure white, warm classic, and dark themes', async () => {
    const { useUIStore } = await import('./uiStore')

    useUIStore.getState().toggleTheme()
    expect(useUIStore.getState().theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')

    useUIStore.getState().toggleTheme()
    expect(useUIStore.getState().theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    useUIStore.getState().toggleTheme()
    expect(useUIStore.getState().theme).toBe('white')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('syncs theme changes to the desktop native appearance host', async () => {
    const setTheme = vi.fn().mockResolvedValue(undefined)
    window.desktopHost = {
      app: { setTheme },
    } as never

    const { applyTheme } = await import('./uiStore')

    applyTheme('dark')

    expect(setTheme).toHaveBeenCalledWith('dark')
  })
})

describe('uiStore settings tab persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('hydrates the last selected Settings tab after the renderer store is recreated', async () => {
    const first = await import('./uiStore')

    first.useUIStore.getState().setActiveSettingsTab('general')

    expect(window.localStorage.getItem('claude-abay-active-settings-tab')).toBe('general')

    vi.resetModules()
    const recreated = await import('./uiStore')

    expect(recreated.useUIStore.getState().activeSettingsTab).toBe('general')
  })

  it('ignores an invalid persisted Settings tab', async () => {
    window.localStorage.setItem('claude-abay-active-settings-tab', 'not-a-settings-tab')

    const { useUIStore } = await import('./uiStore')

    expect(useUIStore.getState().activeSettingsTab).toBe('providers')
  })
})
