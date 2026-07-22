import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  MARKET_TAB_ID,
  SCHEDULED_TAB_ID,
  SETTINGS_TAB_ID,
  SUBAGENT_TAB_PREFIX,
  TERMINAL_TAB_PREFIX,
  TRACE_LIST_TAB_ID,
  TRACE_TAB_PREFIX,
  WORKBENCH_TAB_PREFIX,
  useTabStore,
  type Tab,
} from '../../stores/tabStore'
import { useActivityPanelStore } from '../../stores/activityPanelStore'
import { useChatStore } from '../../stores/chatStore'
import { useCLITaskStore } from '../../stores/cliTaskStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useTeamStore } from '../../stores/teamStore'
import { useTerminalPanelStore } from '../../stores/terminalPanelStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { buildSessionActivityModel, hasVisibleSessionActivity } from '../activity/sessionActivityModel'
import { SessionActivityButton } from '../activity/SessionActivityButton'
import { getSessionBrowsablePath } from '../../lib/sessionWorkspace'
import { hasRunningBackgroundTasks } from '../../lib/backgroundTasks'
import { getDesktopHost } from '../../lib/desktopHost'
import { useTranslation } from '../../i18n'
import { OpenProjectMenu } from './OpenProjectMenu'
import { WindowControls, showWindowControls } from './WindowControls'
import { Folder, FolderOpen, SquareTerminal } from 'lucide-react'

const desktopHost = getDesktopHost()
const isDesktopRuntime = desktopHost.isDesktop
const EMPTY_DISMISSED_BACKGROUND_TASK_KEYS: readonly string[] = []

function isSessionTab(tab: Tab | null | undefined) {
  if (!tab) return false
  const tabType = (tab as Partial<Tab>).type
  if (tabType === 'session') return true
  if (tabType) return false
  return isSessionTabId(tab.sessionId)
}

function isSessionTabId(tabId: string | null) {
  if (!tabId) return false
  return tabId !== SETTINGS_TAB_ID &&
    tabId !== SCHEDULED_TAB_ID &&
    tabId !== MARKET_TAB_ID &&
    tabId !== TRACE_LIST_TAB_ID &&
    !tabId.startsWith(TERMINAL_TAB_PREFIX) &&
    !tabId.startsWith(TRACE_TAB_PREFIX) &&
    !tabId.startsWith(WORKBENCH_TAB_PREFIX) &&
    !tabId.startsWith(SUBAGENT_TAB_PREFIX)
}

function activeTitleForTab(tab: Tab | undefined, sessionTitle: string | undefined, fallback: string) {
  if (!tab) return fallback
  if (isSessionTab(tab)) return sessionTitle || tab.title || fallback
  return tab.title || fallback
}

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const activeTab = tabs.find((tab) => tab.sessionId === activeTabId)
  const activeSession = useSessionStore((state) =>
    activeTabId ? state.sessions.find((session) => session.id === activeTabId) : undefined,
  )
  const t = useTranslation()
  const isActiveSessionTab = isSessionTab(activeTab) || isSessionTabId(activeTabId)
  const openProjectPath = isActiveSessionTab
    ? getSessionBrowsablePath(activeSession) ?? null
    : null
  const sessionTabIds = useMemo(
    () => tabs.filter((tab) => isSessionTab(tab)).map((tab) => tab.sessionId),
    [tabs],
  )
  const activeChatSessionIds = useChatStore(useShallow((state) =>
    sessionTabIds.filter((sessionId) => {
      const sessionState = state.sessions[sessionId]
      return !!sessionState &&
        (sessionState.chatState !== 'idle' || hasRunningBackgroundTasks(sessionState.backgroundAgentTasks))
    })
  ))
  const runningSessionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const tab of tabs) {
      if (isSessionTab(tab) && tab.status === 'running') ids.add(tab.sessionId)
    }
    for (const sessionId of activeChatSessionIds) ids.add(sessionId)
    return ids
  }, [activeChatSessionIds, tabs])
  const isActiveSessionRunning = activeTabId ? runningSessionIds.has(activeTabId) : false
  const isWorkbenchOpen = useWorkspacePanelStore((state) =>
    activeTabId && isActiveSessionTab ? state.isPanelOpen(activeTabId) : false,
  )
  const workbenchMode = useWorkspacePanelStore((state) =>
    activeTabId && isActiveSessionTab ? state.getMode(activeTabId) : 'workspace',
  )
  const isWorkspacePanelOpen = isWorkbenchOpen && workbenchMode === 'workspace'
  const isTerminalPanelOpen = useTerminalPanelStore((state) =>
    activeTabId && isActiveSessionTab ? state.isPanelOpen(activeTabId) : false,
  )
  const cliTasks = useCLITaskStore((state) => state.tasks)
  const cliTasksSessionId = useCLITaskStore((state) => state.sessionId)
  const cliTasksCompletedAndDismissed = useCLITaskStore((state) => state.completedAndDismissed)
  const dismissedBackgroundTaskKeyList = useActivityPanelStore((state) =>
    activeTabId
      ? state.dismissedBackgroundTaskKeysBySession[activeTabId] ?? EMPTY_DISMISSED_BACKGROUND_TASK_KEYS
      : EMPTY_DISMISSED_BACKGROUND_TASK_KEYS,
  )
  const dismissedBackgroundTaskKeys = useMemo(
    () => new Set(dismissedBackgroundTaskKeyList),
    [dismissedBackgroundTaskKeyList],
  )
  const activityTeamMembers = useTeamStore(useShallow((state) => {
    const activeTeam = state.activeTeam
    if (!activeTabId || !activeTeam || activeTeam.leadSessionId !== activeTabId) return []
    return activeTeam.members.filter((member) =>
      !activeTeam.leadAgentId || member.agentId !== activeTeam.leadAgentId
    )
  }))
  const hasActivity = useChatStore(useShallow((state) => {
    if (!activeTabId || !isActiveSessionTab) return false
    const sessionState = state.sessions[activeTabId]
    const includeCliTasks = cliTasksSessionId === activeTabId
    return hasVisibleSessionActivity(buildSessionActivityModel({
      sessionId: activeTabId,
      messages: sessionState?.messages ?? [],
      tasks: includeCliTasks ? cliTasks : [],
      completedAndDismissed: includeCliTasks ? cliTasksCompletedAndDismissed : false,
      backgroundTasks: Object.values(sessionState?.backgroundAgentTasks ?? {}),
      dismissedBackgroundTaskKeys,
      agentNotifications: Object.values(sessionState?.agentTaskNotifications ?? {}),
      teamMembers: activityTeamMembers,
    }))
  }))
  const showActivityButton = activeTabId && hasActivity && !isWorkbenchOpen
  const title = activeTitleForTab(activeTab, activeSession?.title, t('session.untitled'))

  return (
    <div
      data-testid="tab-bar"
      data-desktop-drag-region={isDesktopRuntime ? true : undefined}
      className="flex min-h-11 items-stretch bg-[var(--color-surface-container)] select-none"
    >
      <div
        data-testid="tab-bar-title-region"
        data-desktop-drag-region={isDesktopRuntime ? true : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 px-4"
      >
        <CurrentTitleIcon tab={activeTab} isRunning={isActiveSessionRunning} runningLabel={t('tabs.sessionRunning')} />
        <h1 className="min-w-0 truncate text-sm font-medium text-[var(--color-text-primary)]">
          {title}
        </h1>
      </div>

      <div className="tab-bar-interactive flex shrink-0 items-center gap-1 px-2">
        {showActivityButton && activeTabId && (
          <SessionActivityButton sessionId={activeTabId} />
        )}
        {isDesktopRuntime && isActiveSessionTab && (
          <OpenProjectMenu path={openProjectPath} />
        )}
        <ToolbarIconButton
          icon={<SquareTerminal size={17} strokeWidth={1.9} />}
          label={t('tabs.openTerminal')}
          onClick={() => {
            if (activeTabId && isActiveSessionTab) {
              useTerminalPanelStore.getState().togglePanel(activeTabId)
              return
            }
            useTabStore.getState().openTerminalTab()
          }}
          active={isTerminalPanelOpen}
        />
        {isActiveSessionTab && activeTabId && (
          <ToolbarIconButton
            icon={isWorkspacePanelOpen ? <FolderOpen size={18} strokeWidth={1.9} /> : <Folder size={18} strokeWidth={1.9} />}
            label={t(isWorkspacePanelOpen ? 'tabs.hideWorkspace' : 'tabs.showWorkspace')}
            onClick={() => {
              const workbench = useWorkspacePanelStore.getState()
              if (workbench.isPanelOpen(activeTabId) && workbench.getMode(activeTabId) === 'workspace') {
                workbench.closePanel(activeTabId)
              } else {
                workbench.setMode(activeTabId, 'workspace')
                workbench.openPanel(activeTabId)
              }
            }}
            active={isWorkspacePanelOpen}
          />
        )}
      </div>

      {isDesktopRuntime && (
        <div
          data-testid="tab-bar-drag-gutter"
          data-desktop-drag-region
          aria-hidden="true"
          className={`min-h-11 flex-shrink-0 ${showWindowControls ? 'w-3' : 'w-4'}`}
        />
      )}

      <WindowControls />
    </div>
  )
}

function CurrentTitleIcon({
  tab,
  isRunning,
  runningLabel,
}: {
  tab: Tab | undefined
  isRunning: boolean
  runningLabel: string
}) {
  if (isSessionTab(tab)) {
    return isRunning ? (
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-success)] animate-pulse"
        aria-label={runningLabel}
        title={runningLabel}
      />
    ) : null
  }

  const iconName = tab?.type === 'settings'
    ? 'settings'
    : tab?.type === 'scheduled'
      ? 'schedule'
      : tab?.type === 'terminal'
        ? 'terminal'
        : tab?.type === 'workbench'
          ? 'view_sidebar'
          : null

  return iconName ? (
    <span className="material-symbols-outlined flex-shrink-0 text-[18px] text-[var(--color-text-tertiary)]">
      {iconName}
    </span>
  ) : null
}

function ToolbarIconButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      data-active={active ? 'true' : 'false'}
      className={`tab-bar-interactive inline-flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] ${
        active
          ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      {icon}
    </button>
  )
}
