import { api } from './client'
import { getDesktopHost } from '../lib/desktopHost'
import type { SkillMeta, SkillDetail } from '../types/skill'

export type SkillInstallResult = {
  installed: string[]
  skipped: string[]
  skillsDir: string
}

export const skillsApi = {
  list: (cwd?: string) => {
    const query = cwd ? `?cwd=${encodeURIComponent(cwd)}` : ''
    return api.get<{ skills: SkillMeta[] }>(`/api/skills${query}`, { timeout: 120_000 })
  },

  detail: (source: string, name: string, cwd?: string) => {
    const query = new URLSearchParams({
      source,
      name,
    })
    if (cwd) query.set('cwd', cwd)

    return api.get<{ detail: SkillDetail }>(
      `/api/skills/detail?${query.toString()}`,
      { timeout: 120_000 },
    )
  },

  installFromPaths: (paths: string[]) => {
    return getDesktopHost().commands.invoke<SkillInstallResult>(
      'install_skills_from_paths',
      { paths },
    )
  },
}
