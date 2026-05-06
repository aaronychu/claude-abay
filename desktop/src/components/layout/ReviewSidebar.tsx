import { useCallback, useEffect, useMemo, useState } from 'react'
import { gitReviewApi, type GitReviewFile, type GitReviewSnapshot } from '../../api/gitReview'
import { useSessionStore } from '../../stores/sessionStore'
import { useTabStore } from '../../stores/tabStore'
import { useUIStore } from '../../stores/uiStore'

type ReviewAction = 'stage_all' | 'unstage_all' | 'revert_unstaged'

export function ReviewSidebar() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const sessions = useSessionStore((s) => s.sessions)
  const setReviewSidebarOpen = useUIStore((s) => s.setReviewSidebarOpen)
  const addToast = useUIStore((s) => s.addToast)
  const [snapshot, setSnapshot] = useState<GitReviewSnapshot | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [actionPending, setActionPending] = useState<ReviewAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const session = sessions.find((item) => item.id === activeTabId)
  const cwd = session?.workDir ?? null

  const selectedFile = useMemo(() => {
    if (!snapshot) return null
    return snapshot.files.find((file) => file.path === selectedPath) ?? snapshot.files[0] ?? null
  }, [selectedPath, snapshot])

  const loadSnapshot = useCallback(async () => {
    if (!cwd) {
      setSnapshot(null)
      setError('Open a session with a workspace to review changes.')
      return
    }
    if (!gitReviewApi.isAvailable()) {
      setSnapshot(null)
      setError('Review changes is available in the desktop app.')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const next = await gitReviewApi.snapshot(cwd)
      setSnapshot(next)
      setSelectedPath((current) => {
        if (current && next.files.some((file) => file.path === current)) return current
        return next.files[0]?.path ?? null
      })
    } catch (err) {
      setSnapshot(null)
      setSelectedPath(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [cwd])

  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  const runAction = async (action: ReviewAction) => {
    if (!cwd) return
    if (action === 'revert_unstaged') {
      const ok = window.confirm('Revert all unstaged file changes in this workspace?')
      if (!ok) return
    }

    setActionPending(action)
    try {
      await gitReviewApi.action(cwd, action)
      await loadSnapshot()
      addToast({ type: 'success', message: actionLabel(action) })
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setActionPending(null)
    }
  }

  return (
    <aside className="review-sidebar-shell flex h-full w-[420px] shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-surface)]">
      <header className="flex h-[49px] shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[var(--color-text-secondary)]">fact_check</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">Review</h2>
              {snapshot && (
                <span className="rounded-full bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-tertiary)]">
                  {snapshot.files.length}
                </span>
              )}
            </div>
            <p className="truncate text-[10px] text-[var(--color-text-tertiary)]">
              {snapshot ? `${snapshot.branch} · ${shortPath(snapshot.repo_root)}` : 'Git changes'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void loadSnapshot()}
            className="review-icon-button"
            aria-label="Refresh changes"
          >
            <span className={`material-symbols-outlined text-[17px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setReviewSidebarOpen(false)}
            className="review-icon-button"
            aria-label="Close review"
          >
            <span className="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <section className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                <span>{snapshot?.files.length ? 'Unstaged' : 'Changes'}</span>
                {snapshot && (
                  <span className="text-xs font-medium">
                    <span className="text-[var(--color-success)]">+{snapshot.total_additions}</span>
                    <span className="mx-1 text-[var(--color-text-tertiary)]"> </span>
                    <span className="text-[var(--color-error)]">-{snapshot.total_deletions}</span>
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                {cwd || 'No workspace selected'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void runAction('unstage_all')}
                disabled={!snapshot?.files.some((file) => file.staged) || !!actionPending}
                className="review-action-button"
              >
                Unstage
              </button>
              <button
                type="button"
                onClick={() => void runAction('stage_all')}
                disabled={!snapshot?.files.length || !!actionPending}
                className="review-action-button"
              >
                Stage all
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="material-symbols-outlined mb-3 text-[32px] text-[var(--color-text-tertiary)]">folder_off</span>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">No review available</p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">{error}</p>
          </div>
        ) : snapshot && snapshot.files.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="material-symbols-outlined mb-3 text-[32px] text-[var(--color-success)]">check_circle</span>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">No local changes</p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Your working tree is clean.</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(150px,0.34fr)_minmax(0,1fr)]">
            <FileList
              files={snapshot?.files ?? []}
              selectedPath={selectedFile?.path ?? null}
              onSelect={setSelectedPath}
            />
            <DiffPreview file={selectedFile} />
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-3">
        <button
          type="button"
          onClick={() => void runAction('revert_unstaged')}
          disabled={!snapshot?.files.some((file) => file.unstaged) || !!actionPending}
          className="review-action-button"
        >
          Revert unstaged
        </button>
        <button
          type="button"
          onClick={() => void loadSnapshot()}
          className="review-action-button"
          disabled={isLoading}
        >
          Refresh
        </button>
      </footer>
    </aside>
  )
}

function FileList({
  files,
  selectedPath,
  onSelect,
}: {
  files: GitReviewFile[]
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  return (
    <div className="min-h-0 overflow-y-auto border-b border-[var(--color-border)] py-2">
      {files.map((file) => (
        <button
          key={file.path}
          type="button"
          onClick={() => onSelect(file.path)}
          className={`flex w-full items-center gap-2 px-4 py-2 text-left transition-colors ${
            file.path === selectedPath ? 'bg-[var(--color-surface-selected)]' : 'hover:bg-[var(--color-surface-hover)]'
          }`}
        >
          <span className="material-symbols-outlined shrink-0 text-[17px] text-[var(--color-text-tertiary)]">
            {file.staged ? 'inventory' : 'draft'}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-text-primary)]">
            {file.path}
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-[var(--color-success)]">+{file.additions}</span>
          <span className="shrink-0 text-[11px] font-semibold text-[var(--color-error)]">-{file.deletions}</span>
        </button>
      ))}
    </div>
  )
}

function DiffPreview({ file }: { file: GitReviewFile | null }) {
  if (!file) return null

  return (
    <div className="min-h-0 overflow-hidden">
      <div className="flex h-10 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4">
        <div className="min-w-0 truncate text-xs font-semibold text-[var(--color-text-primary)]">
          {file.path}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px]">
          <span className="text-[var(--color-success)]">+{file.additions}</span>
          <span className="text-[var(--color-error)]">-{file.deletions}</span>
        </div>
      </div>
      <div className="h-[calc(100%-2.5rem)] overflow-auto bg-[var(--color-surface-container-low)]">
        {file.diff.length === 0 ? (
          <div className="px-4 py-6 text-xs text-[var(--color-text-tertiary)]">
            Binary file, renamed file, or staged-only metadata change.
          </div>
        ) : (
          <pre className="min-w-full py-2 text-[11px] leading-5">
            {file.diff.map((line, index) => (
              <div key={`${file.path}-${index}`} className={`diff-preview-line ${diffLineClass(line)}`}>
                <span className="select-none pr-3 text-[var(--color-text-tertiary)]">{index + 1}</span>
                <code>{line || ' '}</code>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  )
}

function diffLineClass(line: string) {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'diff-preview-line-added'
  if (line.startsWith('-') && !line.startsWith('---')) return 'diff-preview-line-removed'
  if (line.startsWith('@@')) return 'diff-preview-line-hunk'
  return ''
}

function actionLabel(action: ReviewAction) {
  switch (action) {
    case 'stage_all':
      return 'Staged all changes'
    case 'unstage_all':
      return 'Unstaged all changes'
    case 'revert_unstaged':
      return 'Reverted unstaged changes'
  }
}

function shortPath(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.slice(-2).join('/') || path
}
