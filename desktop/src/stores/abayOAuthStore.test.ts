import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { startMock, statusMock, logoutMock } = vi.hoisted(() => ({
  startMock: vi.fn(),
  statusMock: vi.fn(),
  logoutMock: vi.fn(),
}))

vi.mock('../api/abayOAuth', () => ({
  abayOAuthApi: {
    start: startMock,
    status: statusMock,
    logout: logoutMock,
  },
}))

import { useAbayOAuthStore } from './abayOAuthStore'

const initialState = useAbayOAuthStore.getState()

describe('abayOAuthStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    startMock.mockReset()
    statusMock.mockReset()
    logoutMock.mockReset()
    useAbayOAuthStore.setState({
      ...initialState,
      status: null,
      isPolling: false,
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    useAbayOAuthStore.getState().stopPolling()
    useAbayOAuthStore.setState(initialState)
    vi.useRealTimers()
  })

  it('login does not start polling until the browser launch succeeds', async () => {
    startMock.mockResolvedValue({
      authorizeUrl: 'http://localhost:3456/api/abay-oauth/callback',
      state: 'state-123',
    })

    const result = await useAbayOAuthStore.getState().login()

    expect(result.authorizeUrl).toContain('/api/abay-oauth/callback')
    expect(useAbayOAuthStore.getState().isPolling).toBe(false)
  })

  it('startPolling stops after the status becomes logged in', async () => {
    statusMock
      .mockResolvedValueOnce({ loggedIn: false })
      .mockResolvedValueOnce({
        loggedIn: true,
        expiresAt: Date.now() + 60_000,
        scopes: ['user:inference'],
        subscriptionType: 'max',
      })

    useAbayOAuthStore.getState().startPolling()
    expect(useAbayOAuthStore.getState().isPolling).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(useAbayOAuthStore.getState().isPolling).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(useAbayOAuthStore.getState().status).toMatchObject({
      loggedIn: true,
      subscriptionType: 'max',
    })
    expect(useAbayOAuthStore.getState().isPolling).toBe(false)
  })
})
