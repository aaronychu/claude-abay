import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import type { PerSessionState } from '../../stores/chatStore'
import type { ChatState, UIMessage } from '../../types/chat'
import { browserHost } from '../../lib/desktopHost/browserHost'

type ToolUseMessage = Extract<UIMessage, { type: 'tool_use' }>

const startDraggingMock = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const getCurrentWindowMock = vi.hoisted(() => vi.fn(() => ({
  startDragging: startDraggingMock,
})))
const windowControlsMock = vi.hoisted(() => ({
  show: true,
}))
const scrollIntoViewMock = vi.hoisted(() => vi.fn())
const deleteSessionMock = vi.hoisted(() => vi.fn())
const openProjectMenuMock = vi.hoisted(() => ({
  paths: [] as Array<string | null | undefined>,
}))
const sessionsApiMock = vi.hoisted(() => ({
  delete: vi.fn(() => Promise.resolve()),
}))

function makeChatSession(chatState: ChatState): PerSessionState {
  return {
    messages: [],
    chatState,
    connectionState: 'connected',
    streamingText: '',
    streamingToolInput: '',
    activeToolUseId: null,
    activeToolName: null,
    activeThinkingId: null,
    pendingPermission: null,
    pendingComputerUsePermission: null,
    tokenUsage: { input_tokens: 0, output_tokens: 0 },
    streamingResponseChars: 0,
    elapsedSeconds: 0,
    statusVerb: '',
    slashCommands: [],
    agentTaskNotifications: {},
    backgroundAgentTasks: {},
    activeGoal: null,
    elapsedTimer: null,
    composerPrefill: null,
    composerDraft: null,
  }
}

const completedTodoWriteMessage = (overrides: Partial<ToolUseMessage> = {}): UIMessage => ({
  id: 'todo-1',
  type: 'tool_use',
  toolName: 'TodoWrite',
  toolUseId: 'todo-1',
  input: {
    todos: [
      { content: 'Review existing implementation', status: 'completed' },
    ],
  },
  timestamp: 1000,
  ...overrides,
})

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: getCurrentWindowMock,
}))

vi.mock('../../api/sessions', () => ({
  sessionsApi: {
    batchDelete: vi.fn(),
    branch: vi.fn(),
    create: vi.fn(),
    delete: deleteSessionMock,
    list: vi.fn(),
    rename: vi.fn(),
  },
}))

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      'tabs.close': 'Close',
      'tabs.closeOthers': 'Close Others',
      'tabs.closeLeft': 'Close Left',
      'tabs.closeRight': 'Close Right',
      'tabs.closeAll': 'Close All',
      'tabs.closeConfirmTitle': 'Session Running',
      'tabs.closeConfirmMessage': 'Still running',
      'tabs.closeConfirmKeep': 'Keep Running',
      'tabs.closeConfirmStop': 'Stop & Close',
      'tabs.closeAllConfirmTitle': 'Sessions Running',
      'tabs.closeAllConfirmMessage': '{count} sessions still running',
      'tabs.closeAllConfirmStop': 'Stop All & Close',
      'tabs.sessionRunning': 'Session running',
      'tabs.openTerminal': 'Open Terminal',
      'tabs.showWorkspace': 'Show Workspace',
      'tabs.hideWorkspace': 'Hide Workspace',
      'tabs.showBrowser': 'Show Browser',
      'tabs.hideBrowser': 'Hide Browser',
      'openProject.openProject': 'Open project',
      'openProject.openIn': 'Open in {target}',
      'openProject.openFailed': 'Could not open project',
      'common.cancel': 'Cancel',
      'session.activity.title': 'Activity',
    }

    let text = translations[key] ?? key
    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
      }
    }
    return text
  },
}))

vi.mock('../../api/sessions', () => ({
  sessionsApi: sessionsApiMock,
}))

vi.mock('./OpenProjectMenu', () => ({
  OpenProjectMenu: ({ path }: { path: string | null | undefined }) => {
    if (!path) return null
    openProjectMenuMock.paths.push(path)
    return <div data-testid="open-project-menu">{path}</div>
  },
}))

vi.mock('./WindowControls', () => ({
  WindowControls: () => (windowControlsMock.show ? <div data-testid="window-controls" /> : null),
  get showWindowControls() {
    return windowControlsMock.show
  },
}))

describe('TabBar', () => {
  const installElectronDesktopHost = () => {
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      capabilities: {
        ...browserHost.capabilities,
        windowControls: true,
      },
      window: {
        ...browserHost.window,
        startDragging: startDraggingMock,
      },
    }
  }

  beforeEach(() => {
    class ResizeObserverMock {
      constructor(_callback: ResizeObserverCallback) {}

      observe(_target: Element) {}

      disconnect() {}
      unobserve() {}
    }

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverMock,
    })

    Reflect.deleteProperty(window, '__TAURI__')
    installElectronDesktopHost()

    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    })

    startDraggingMock.mockClear()
    getCurrentWindowMock.mockClear()
    scrollIntoViewMock.mockClear()
    deleteSessionMock.mockReset()
    deleteSessionMock.mockResolvedValue(undefined)
    openProjectMenuMock.paths = []
    sessionsApiMock.delete.mockClear()
    sessionsApiMock.delete.mockResolvedValue(undefined)
    windowControlsMock.show = true
    vi.resetModules()
  })

  afterEach(async () => {
    cleanup()

    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const { useWorkspacePanelStore } = await import('../../stores/workspacePanelStore')
    const { useTerminalPanelStore } = await import('../../stores/terminalPanelStore')
    const { useBrowserPanelStore } = await import('../../stores/browserPanelStore')
    const { useActivityPanelStore } = await import('../../stores/activityPanelStore')
    const { useCLITaskStore } = await import('../../stores/cliTaskStore')
    const { useTeamStore } = await import('../../stores/teamStore')

    useTabStore.setState({ tabs: [], activeTabId: null })
    useChatStore.setState({
      sessions: {},
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      isLoading: false,
      error: null,
      isBatchMode: false,
      selectedSessionIds: new Set(),
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useWorkspacePanelStore.setState(useWorkspacePanelStore.getInitialState(), true)
    useTerminalPanelStore.setState(useTerminalPanelStore.getInitialState(), true)
    useBrowserPanelStore.setState(useBrowserPanelStore.getInitialState(), true)
    useActivityPanelStore.setState(useActivityPanelStore.getInitialState(), true)
    useCLITaskStore.setState(useCLITaskStore.getInitialState(), true)
    useTeamStore.setState({
      teams: [],
      activeTeam: null,
      memberColors: new Map(),
      error: null,
    })

    Reflect.deleteProperty(window, 'desktopHost')
    Reflect.deleteProperty(window, '__TAURI__')
  })

  it('hides the activity button for no-activity chat session tabs', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const sessionId = 'session-1'

    useTabStore.setState({
      tabs: [{ sessionId, title: 'Chat', type: 'session', status: 'idle' }],
      activeTabId: sessionId,
    })
    useSessionStore.setState({
      sessions: [{ id: sessionId, title: 'Chat', workDir: '/tmp/project', workDirExists: true }],
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useChatStore.setState({
      sessions: {
        [sessionId]: makeChatSession('idle'),
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()
  })

  it('hides the activity button for output-only activity rows', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const sessionId = 'session-1'
    const chatSession = makeChatSession('idle')
    chatSession.agentTaskNotifications = {
      'bash-tool-1': {
        taskId: 'bg-bash-1',
        toolUseId: 'bash-tool-1',
        status: 'completed',
        summary: 'Task completed',
        outputFile: '/tmp/bg-test.log',
      },
    }

    useTabStore.setState({
      tabs: [{ sessionId, title: 'Chat', type: 'session', status: 'idle' }],
      activeTabId: sessionId,
    })
    useSessionStore.setState({
      sessions: [{ id: sessionId, title: 'Chat', workDir: '/tmp/project', workDirExists: true }],
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useChatStore.setState({
      sessions: {
        [sessionId]: chatSession,
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('session-activity-badge')).not.toBeInTheDocument()
  })

  it('shows the activity button for completed TodoWrite history and hides it while the workspace is open', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const { useWorkspacePanelStore } = await import('../../stores/workspacePanelStore')
    const sessionId = 'session-1'
    const chatSession = makeChatSession('idle')
    chatSession.messages = [completedTodoWriteMessage()]

    useTabStore.setState({
      tabs: [{ sessionId, title: 'Chat', type: 'session', status: 'idle' }],
      activeTabId: sessionId,
    })
    useSessionStore.setState({
      sessions: [{ id: sessionId, title: 'Chat', workDir: '/tmp/project', workDirExists: true }],
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useChatStore.setState({
      sessions: {
        [sessionId]: chatSession,
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
    expect(screen.queryByTestId('session-activity-badge')).not.toBeInTheDocument()

    act(() => {
      useWorkspacePanelStore.getState().openPanel(sessionId)
    })

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()
  })

  it('shows the activity button without a numeric badge for running or failed activity', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const { useActivityPanelStore } = await import('../../stores/activityPanelStore')
    const sessionId = 'session-1'
    const chatSession = makeChatSession('idle')
    chatSession.backgroundAgentTasks = {
      'agent-1': {
        taskId: 'agent-1',
        toolUseId: 'tool-1',
        status: 'running',
        taskType: 'local_agent',
        description: 'Explore',
        startedAt: 1,
        updatedAt: 2,
      },
      'agent-2': {
        taskId: 'agent-2',
        toolUseId: 'tool-2',
        status: 'failed',
        taskType: 'local_agent',
        description: 'Report',
        startedAt: 3,
        updatedAt: 4,
      },
    }

    useTabStore.setState({
      tabs: [{ sessionId, title: 'Chat', type: 'session', status: 'idle' }],
      activeTabId: sessionId,
    })
    useSessionStore.setState({
      sessions: [{ id: sessionId, title: 'Chat', workDir: '/tmp/project', workDirExists: true }],
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useChatStore.setState({
      sessions: {
        [sessionId]: chatSession,
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    const button = screen.getByRole('button', { name: /activity/i })
    expect(button).toBeInTheDocument()
    expect(screen.queryByTestId('session-activity-badge')).not.toBeInTheDocument()
    expect(useActivityPanelStore.getState().isOpen(sessionId)).toBe(false)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(button)

    expect(button).toHaveAttribute('data-active', 'true')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(useActivityPanelStore.getState().isOpen(sessionId)).toBe(true)
  })

  it('shows the activity button for team members associated with the active session', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const { useTeamStore } = await import('../../stores/teamStore')
    const sessionId = 'session-team'

    useTabStore.setState({
      tabs: [{ sessionId, title: 'Team Chat', type: 'session', status: 'idle' }],
      activeTabId: sessionId,
    })
    useSessionStore.setState({
      sessions: [{ id: sessionId, title: 'Team Chat', workDir: '/tmp/project', workDirExists: true }],
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useChatStore.setState({
      sessions: {
        [sessionId]: makeChatSession('idle'),
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useTeamStore.setState({
      activeTeam: {
        name: 'review-team',
        leadAgentId: 'lead',
        leadSessionId: sessionId,
        members: [
          { agentId: 'lead', role: 'Lead', status: 'running' },
          { agentId: 'security', role: 'Security reviewer', status: 'running' },
        ],
      },
    } as Partial<ReturnType<typeof useTeamStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
    expect(screen.queryByTestId('session-activity-badge')).not.toBeInTheDocument()
  })

  it('hides team-only activity when the active team belongs to another session', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const { useTeamStore } = await import('../../stores/teamStore')
    const sessionId = 'session-team'

    useTabStore.setState({
      tabs: [{ sessionId, title: 'Team Chat', type: 'session', status: 'idle' }],
      activeTabId: sessionId,
    })
    useSessionStore.setState({
      sessions: [{ id: sessionId, title: 'Team Chat', workDir: '/tmp/project', workDirExists: true }],
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useChatStore.setState({
      sessions: {
        [sessionId]: makeChatSession('idle'),
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useTeamStore.setState({
      activeTeam: {
        name: 'other-review-team',
        leadAgentId: 'lead',
        leadSessionId: 'other-session',
        members: [
          { agentId: 'security', role: 'Security reviewer', status: 'running' },
        ],
      },
    } as Partial<ReturnType<typeof useTeamStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('session-activity-badge')).not.toBeInTheDocument()
  })

  it('shows the activity button without a badge when team activity arrives after initial render', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const { useTeamStore } = await import('../../stores/teamStore')
    const sessionId = 'session-team'

    useTabStore.setState({
      tabs: [{ sessionId, title: 'Team Chat', type: 'session', status: 'idle' }],
      activeTabId: sessionId,
    })
    useSessionStore.setState({
      sessions: [{ id: sessionId, title: 'Team Chat', workDir: '/tmp/project', workDirExists: true }],
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useChatStore.setState({
      sessions: {
        [sessionId]: makeChatSession('idle'),
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()

    await act(async () => {
      useTeamStore.setState({
        activeTeam: {
          name: 'review-team',
          leadAgentId: 'lead',
          leadSessionId: sessionId,
          members: [
            { agentId: 'security', role: 'Security reviewer', status: 'error' },
          ],
        },
      } as Partial<ReturnType<typeof useTeamStore.getState>>)
    })

    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
    expect(screen.queryByTestId('session-activity-badge')).not.toBeInTheDocument()
  })

  it('does not show the activity button for settings tabs', async () => {
    const { TabBar } = await import('./TabBar')
    const { SETTINGS_TAB_ID, useTabStore } = await import('../../stores/tabStore')

    useTabStore.setState({
      tabs: [{ sessionId: SETTINGS_TAB_ID, title: 'Settings', type: 'settings', status: 'idle' }],
      activeTabId: SETTINGS_TAB_ID,
    })

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()
  })

  it('shows current-session CLI tasks without a numeric activity badge', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const { useCLITaskStore } = await import('../../stores/cliTaskStore')
    const sessionId = 'session-1'

    useTabStore.setState({
      tabs: [{ sessionId, title: 'Chat', type: 'session', status: 'idle' }],
      activeTabId: sessionId,
    })
    useSessionStore.setState({
      sessions: [{ id: sessionId, title: 'Chat', workDir: '/tmp/project', workDirExists: true }],
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useChatStore.setState({
      sessions: {
        [sessionId]: makeChatSession('idle'),
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useCLITaskStore.setState({
      sessionId,
      tasks: [
        {
          id: 'task-1',
          subject: 'Plan work',
          description: '',
          status: 'pending',
          blocks: [],
          blockedBy: [],
          taskListId: sessionId,
        },
        {
          id: 'task-2',
          subject: 'Ship work',
          description: '',
          status: 'in_progress',
          blocks: [],
          blockedBy: [],
          taskListId: sessionId,
        },
      ],
      completedAndDismissed: false,
    })

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByTestId('session-activity-badge')).not.toBeInTheDocument()
  })

  it('keeps running activity available without showing a numeric badge', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const { useActivityPanelStore } = await import('../../stores/activityPanelStore')
    const { createBackgroundTaskDismissKey } = await import('../../lib/backgroundTasks')
    const sessionId = 'session-1'
    const failedTask = {
      taskId: 'failed-task-1',
      toolUseId: 'failed-tool-1',
      status: 'failed' as const,
      taskType: 'local_bash',
      description: 'Failed run',
      startedAt: 1000,
      updatedAt: 2000,
    }
    const runningTask = {
      taskId: 'running-task-1',
      toolUseId: 'running-tool-1',
      status: 'running' as const,
      taskType: 'local_bash',
      description: 'Running run',
      startedAt: 1000,
      updatedAt: 2000,
    }
    const chatSession = makeChatSession('idle')
    chatSession.backgroundAgentTasks = {
      [failedTask.taskId]: failedTask,
      [runningTask.taskId]: runningTask,
    }

    useActivityPanelStore.getState().dismissBackgroundTaskKeys(sessionId, [
      createBackgroundTaskDismissKey(failedTask),
    ])
    useTabStore.setState({
      tabs: [{ sessionId, title: 'Chat', type: 'session', status: 'idle' }],
      activeTabId: sessionId,
    })
    useSessionStore.setState({
      sessions: [{ id: sessionId, title: 'Chat', workDir: '/tmp/project', workDirExists: true }],
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useChatStore.setState({
      sessions: {
        [sessionId]: chatSession,
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByTestId('session-activity-badge')).not.toBeInTheDocument()
  })

  it('ignores CLI tasks from a different session in the activity badge', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')
    const { useCLITaskStore } = await import('../../stores/cliTaskStore')

    useTabStore.setState({
      tabs: [{ sessionId: 'session-1', title: 'Chat', type: 'session', status: 'idle' }],
      activeTabId: 'session-1',
    })
    useSessionStore.setState({
      sessions: [{ id: 'session-1', title: 'Chat', workDir: '/tmp/project', workDirExists: true }],
    } as Partial<ReturnType<typeof useSessionStore.getState>>)
    useChatStore.setState({
      sessions: {
        'session-1': makeChatSession('idle'),
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useCLITaskStore.setState({
      sessionId: 'session-2',
      tasks: [{
        id: 'task-1',
        subject: 'Other session work',
        description: '',
        status: 'in_progress',
        blocks: [],
        blockedBy: [],
        taskListId: 'session-2',
      }],
      completedAndDismissed: false,
    })

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('session-activity-badge')).not.toBeInTheDocument()
  })

  it('shows the active title instead of rendering multiple tabs', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'First Session', type: 'session', status: 'idle' },
        { sessionId: 'tab-2', title: 'Second Session', type: 'session', status: 'idle' },
        { sessionId: 'tab-3', title: 'Third Session', type: 'session', status: 'idle' },
        { sessionId: 'tab-4', title: 'Fourth Session', type: 'session', status: 'idle' },
        { sessionId: 'tab-5', title: 'New Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.getByRole('heading', { name: 'First Session' })).toBeInTheDocument()
    expect(screen.queryByText('Second Session')).not.toBeInTheDocument()
    expect(screen.queryByText('Third Session')).not.toBeInTheDocument()
    expect(screen.queryByText('Fourth Session')).not.toBeInTheDocument()
    expect(screen.queryByText('New Session')).not.toBeInTheDocument()
    expect(screen.queryByText('chevron_left')).not.toBeInTheDocument()
    expect(screen.queryByText('chevron_right')).not.toBeInTheDocument()
  })

  it('shows the terminal toolbar when no tabs are open', async () => {
    windowControlsMock.show = false
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')

    useTabStore.setState({ tabs: [], activeTabId: null })

    await act(async () => {
      render(<TabBar />)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open Terminal' }))

    const terminalTabs = useTabStore.getState().tabs.filter((tab) => tab.type === 'terminal')
    expect(terminalTabs).toHaveLength(1)
    expect(useTabStore.getState().activeTabId).toBe(terminalTabs[0]?.sessionId)
    expect(screen.queryByTestId('window-controls')).not.toBeInTheDocument()
  })

  it('marks the tab bar as a native drag region', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'Untitled Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.getByTestId('tab-bar')).toHaveAttribute('data-desktop-drag-region')
    expect(screen.getByTestId('tab-bar-title-region')).toHaveAttribute('data-desktop-drag-region')
    expect(screen.getByTestId('tab-bar-drag-gutter')).toHaveAttribute('data-desktop-drag-region')
    expect(screen.getByRole('heading', { name: 'Untitled Session' }).closest('[data-desktop-drag-region]')).toBe(
      screen.getByTestId('tab-bar-title-region'),
    )
    expect(screen.getByRole('button', { name: 'Open Terminal' }).closest('.tab-bar-interactive')).toBeInTheDocument()
  })

  it('keeps the desktop tab strip at a roomier titlebar height', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'Untitled Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    const tabBar = screen.getByTestId('tab-bar')
    const titleRegion = screen.getByTestId('tab-bar-title-region')

    expect(tabBar).toHaveClass('min-h-11')
    expect(titleRegion).toHaveClass('items-center')
    expect(screen.getByTestId('tab-bar-drag-gutter')).toHaveClass('min-h-11')
  })

  it('passes the active session workdir into the open-project control', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'Workspace Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useSessionStore.setState({
      sessions: [{
        id: 'tab-1',
        title: 'Workspace Session',
        createdAt: '2026-05-13T00:00:00.000Z',
        modifiedAt: '2026-05-13T00:00:00.000Z',
        messageCount: 0,
        projectPath: '/repo',
        workDir: '/repo/worktree',
        workDirExists: true,
      }],
      activeSessionId: 'tab-1',
    })

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.getByTestId('open-project-menu')).toHaveTextContent('/repo/worktree')
    expect(openProjectMenuMock.paths[openProjectMenuMock.paths.length - 1]).toBe('/repo/worktree')
  })

  it('does not rerender for chat payload changes when tab running state is unchanged', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'Workspace Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {
        'tab-1': makeChatSession('idle'),
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useSessionStore.setState({
      sessions: [{
        id: 'tab-1',
        title: 'Workspace Session',
        createdAt: '2026-05-13T00:00:00.000Z',
        modifiedAt: '2026-05-13T00:00:00.000Z',
        messageCount: 0,
        projectPath: '/repo',
        workDir: '/repo/worktree',
        workDirExists: true,
      }],
      activeSessionId: 'tab-1',
    })

    await act(async () => {
      render(<TabBar />)
    })
    expect(openProjectMenuMock.paths[openProjectMenuMock.paths.length - 1]).toBe('/repo/worktree')

    openProjectMenuMock.paths = []
    await act(async () => {
      useChatStore.setState((state) => ({
        sessions: {
          ...state.sessions,
          'tab-1': {
            ...state.sessions['tab-1']!,
            streamingText: 'token churn should not affect tab chrome',
          },
        },
      }))
    })

    expect(openProjectMenuMock.paths).toEqual([])
  })

  it('hides the open-project control when the active session workdir is unavailable', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'Workspace Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useSessionStore.setState({
      sessions: [{
        id: 'tab-1',
        title: 'Workspace Session',
        createdAt: '2026-05-13T00:00:00.000Z',
        modifiedAt: '2026-05-13T00:00:00.000Z',
        messageCount: 0,
        projectPath: '/repo',
        workDir: '/repo/worktree',
        workDirExists: false,
      }],
      activeSessionId: 'tab-1',
    })

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByTestId('open-project-menu')).not.toBeInTheDocument()
  })

  it('opens the source project for a cleaned worktree session', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'Cleaned Worktree', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useSessionStore.setState({
      sessions: [{
        id: 'tab-1',
        title: 'Cleaned Worktree',
        createdAt: '2026-05-13T00:00:00.000Z',
        modifiedAt: '2026-05-13T00:00:00.000Z',
        messageCount: 0,
        projectPath: '/repo-worktree',
        projectRoot: '/repo',
        workDir: '/repo/.claude/worktrees/desktop-main-12345678',
        workDirExists: false,
        workspaceState: 'worktree_removed',
      }],
      activeSessionId: 'tab-1',
    })

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.getByTestId('open-project-menu')).toBeInTheDocument()
    expect(openProjectMenuMock.paths[openProjectMenuMock.paths.length - 1]).toBe('/repo')
  })

  it('hides the open-project control outside the desktop shell', async () => {
    Reflect.deleteProperty(window, 'desktopHost')

    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useSessionStore } = await import('../../stores/sessionStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'Workspace Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useSessionStore.setState({
      sessions: [{
        id: 'tab-1',
        title: 'Workspace Session',
        createdAt: '2026-05-13T00:00:00.000Z',
        modifiedAt: '2026-05-13T00:00:00.000Z',
        messageCount: 0,
        projectPath: '/repo',
        workDir: '/repo/worktree',
        workDirExists: true,
      }],
      activeSessionId: 'tab-1',
    })

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByTestId('open-project-menu')).not.toBeInTheDocument()
  })

  it('marks the title region as a native drag region without runtime dragging IPC', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'Untitled Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    const titleRegion = screen.getByTestId('tab-bar-title-region')
    expect(titleRegion).toBeInTheDocument()
    expect(titleRegion).toHaveAttribute('data-desktop-drag-region')

    fireEvent.mouseDown(titleRegion)

    expect(startDraggingMock).not.toHaveBeenCalled()
  })

  it('does not route title clicks through legacy drag IPC', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'Untitled Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    fireEvent.mouseDown(screen.getByText('Untitled Session'))

    expect(startDraggingMock).not.toHaveBeenCalled()
  })

  it('does not render inactive tab controls or close buttons', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'First Session', type: 'session', status: 'idle' },
        { sessionId: 'tab-2', title: 'Second Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.getByRole('heading', { name: 'First Session' })).toBeInTheDocument()
    expect(screen.queryByText('Second Session')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Close First Session')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Close Second Session')).not.toBeInTheDocument()
    expect(useTabStore.getState().tabs.map((tab) => tab.sessionId)).toEqual(['tab-1', 'tab-2'])
    expect(useTabStore.getState().activeTabId).toBe('tab-1')
  })

  it('opens the bottom terminal panel from the toolbar for an active session', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useTerminalPanelStore } = await import('../../stores/terminalPanelStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'First Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open Terminal' }))

    const terminalTabs = useTabStore.getState().tabs.filter((tab) => tab.type === 'terminal')
    expect(terminalTabs).toHaveLength(0)
    expect(useTerminalPanelStore.getState().isPanelOpen('tab-1')).toBe(true)
  })

  it('treats legacy session tabs without a type as bottom-panel terminal targets', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useTerminalPanelStore } = await import('../../stores/terminalPanelStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'legacy-session', title: 'Legacy Session', status: 'idle' } as ReturnType<typeof useTabStore.getState>['tabs'][number],
      ],
      activeTabId: 'legacy-session',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open Terminal' }))

    expect(useTabStore.getState().tabs.some((tab) => tab.type === 'terminal')).toBe(false)
    expect(useTerminalPanelStore.getState().isPanelOpen('legacy-session')).toBe(true)
  })

  it('toggles the workspace panel for the active session from the toolbar', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useWorkspacePanelStore } = await import('../../stores/workspacePanelStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'First Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Show Workspace' }))
    expect(useWorkspacePanelStore.getState().isPanelOpen('tab-1')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Hide Workspace' }))
    expect(useWorkspacePanelStore.getState().isPanelOpen('tab-1')).toBe(false)
  })

  it('does not render a browser toolbar button for session tabs', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-1', title: 'First Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByRole('button', { name: 'Show Browser' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hide Browser' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Review changes' })).not.toBeInTheDocument()
  })

  it('hides the browser toolbar button for non-session tabs', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')

    useTabStore.setState({
      tabs: [
        { sessionId: '__terminal__1', title: 'Terminal 1', type: 'terminal', status: 'idle' },
        { sessionId: '__settings__', title: 'Settings', type: 'settings', status: 'idle' },
      ],
      activeTabId: '__terminal__1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    const { rerender } = render(<TabBar />)

    expect(screen.queryByRole('button', { name: 'Show Browser' })).not.toBeInTheDocument()

    await act(async () => {
      useTabStore.getState().setActiveTab('__settings__')
    })
    rerender(<TabBar />)

    expect(screen.queryByRole('button', { name: 'Show Browser' })).not.toBeInTheDocument()
  })

  it('hides the workspace toolbar button for non-session tabs', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')

    useTabStore.setState({
      tabs: [
        { sessionId: '__terminal__1', title: 'Terminal 1', type: 'terminal', status: 'idle' },
        { sessionId: '__settings__', title: 'Settings', type: 'settings', status: 'idle' },
      ],
      activeTabId: '__terminal__1',
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    const { rerender } = render(<TabBar />)

    expect(screen.queryByRole('button', { name: 'Show Workspace' })).not.toBeInTheDocument()

    await act(async () => {
      useTabStore.getState().setActiveTab('__settings__')
    })
    rerender(<TabBar />)

    expect(screen.queryByRole('button', { name: 'Show Workspace' })).not.toBeInTheDocument()
  })

  it('treats active SubAgent tabs as non-session tabs for toolbar state', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useWorkspacePanelStore } = await import('../../stores/workspacePanelStore')
    const { useTerminalPanelStore } = await import('../../stores/terminalPanelStore')
    const { useActivityPanelStore } = await import('../../stores/activityPanelStore')
    const tabId = '__subagent__session-1__tool-1'

    useTabStore.setState({
      tabs: [{
        sessionId: tabId,
        title: 'Kuhn',
        type: 'subagent',
        status: 'idle',
        sourceSessionId: 'session-1',
        subagentToolUseId: 'tool-1',
      }],
      activeTabId: tabId,
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('open-project-menu')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show Workspace' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Terminal' }))

    expect(useTabStore.getState().tabs.some((tab) => tab.type === 'terminal')).toBe(true)
    expect(useWorkspacePanelStore.getState().panelBySession[tabId]).toBeUndefined()
    expect(useTerminalPanelStore.getState().panelBySession[tabId]).toBeUndefined()
    expect(useActivityPanelStore.getState().isOpen(tabId)).toBe(false)
  })

  it('treats the market tab as a non-session toolbar target', async () => {
    const { TabBar } = await import('./TabBar')
    const { MARKET_TAB_ID, useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const { useTerminalPanelStore } = await import('../../stores/terminalPanelStore')

    useTabStore.setState({
      tabs: [
        { sessionId: MARKET_TAB_ID, title: 'Market', type: 'market', status: 'idle' },
      ],
      activeTabId: MARKET_TAB_ID,
    })
    useChatStore.setState({
      sessions: {},
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.queryByTestId('open-project-menu')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show Workspace' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Terminal' }))

    const terminalTabs = useTabStore.getState().tabs.filter((tab) => tab.type === 'terminal')
    expect(terminalTabs).toHaveLength(1)
    expect(useTabStore.getState().activeTabId).toBe(terminalTabs[0]?.sessionId)
    expect(useTerminalPanelStore.getState().isPanelOpen(MARKET_TAB_ID)).toBe(false)
  })

  it('shows a running marker for the active title only', async () => {
    const { TabBar } = await import('./TabBar')
    const { useTabStore } = await import('../../stores/tabStore')
    const { useChatStore } = await import('../../stores/chatStore')
    const backgroundRunningSession = makeChatSession('idle')
    backgroundRunningSession.backgroundAgentTasks = {
      'agent-task-1': {
        taskId: 'agent-task-1',
        toolUseId: 'agent-tool-1',
        status: 'running',
        taskType: 'local_agent',
        description: 'Review screenshots',
        startedAt: 1,
        updatedAt: 2,
      },
    }

    useTabStore.setState({
      tabs: [
        { sessionId: 'tab-status-running', title: 'Status Running', type: 'session', status: 'running' },
        { sessionId: 'tab-chat-running', title: 'Chat Running', type: 'session', status: 'idle' },
        { sessionId: 'tab-background-running', title: 'Background Running', type: 'session', status: 'idle' },
        { sessionId: 'tab-idle', title: 'Idle', type: 'session', status: 'idle' },
      ],
      activeTabId: 'tab-status-running',
    })
    useChatStore.setState({
      sessions: {
        'tab-status-running': makeChatSession('idle'),
        'tab-chat-running': makeChatSession('thinking'),
        'tab-background-running': backgroundRunningSession,
        'tab-idle': makeChatSession('idle'),
      },
      disconnectSession: vi.fn(),
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    await act(async () => {
      render(<TabBar />)
    })

    expect(screen.getAllByLabelText('Session running')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Status Running' })).toBeInTheDocument()
    expect(screen.queryByText('Chat Running')).not.toBeInTheDocument()
    expect(screen.queryByText('Background Running')).not.toBeInTheDocument()
    expect(screen.queryByText('Idle')).not.toBeInTheDocument()
  })
})
