import { isTauriRuntime } from '../lib/desktopRuntime'

export type GitReviewFile = {
  path: string
  status: string
  additions: number
  deletions: number
  staged: boolean
  unstaged: boolean
  diff: string[]
}

export type GitReviewSnapshot = {
  repo_root: string
  branch: string
  files: GitReviewFile[]
  total_additions: number
  total_deletions: number
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error('Review changes is available in the desktop app runtime.')
  }
  const api = await import(/* @vite-ignore */ '@tauri-apps/api/core')
  return api.invoke<T>(command, args)
}

export const gitReviewApi = {
  isAvailable: isTauriRuntime,

  snapshot(cwd?: string | null) {
    return invoke<GitReviewSnapshot>('git_review_snapshot', { cwd: cwd || null })
  },

  action(cwd: string | null | undefined, action: 'stage_all' | 'unstage_all' | 'revert_unstaged') {
    return invoke<void>('git_review_action', { cwd: cwd || null, action })
  },
}
