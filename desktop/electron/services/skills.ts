import extractZip from 'extract-zip'
import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

export type SkillInstallResult = {
  installed: string[]
  skipped: string[]
  skillsDir: string
}

type SkillInstallInput = {
  paths?: unknown
}

function getClaudeConfigHomeDir() {
  const configured = process.env.CLAUDE_CONFIG_DIR?.trim()
  if (configured) return path.resolve(configured)
  return path.join(app.getPath('home'), '.claude')
}

function sanitizeSkillName(name: string) {
  const sanitized = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
  return sanitized || 'imported-skill'
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function isDirectory(filePath: string) {
  try {
    return (await fs.stat(filePath)).isDirectory()
  } catch {
    return false
  }
}

async function replaceDirectory(source: string, destination: string) {
  await fs.rm(destination, { recursive: true, force: true })
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.cp(source, destination, {
    recursive: true,
    force: true,
    errorOnExist: false,
    verbatimSymlinks: false,
  })
}

async function installSkillDirectory(
  source: string,
  skillsDir: string,
  installed: string[],
  skipped: string[],
) {
  if (await exists(path.join(source, 'SKILL.md'))) {
    const name = sanitizeSkillName(path.basename(source))
    await replaceDirectory(source, path.join(skillsDir, name))
    installed.push(name)
    return
  }

  const entries = await fs.readdir(source, { withFileTypes: true })
  let childCount = 0

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const childPath = path.join(source, entry.name)
    if (!(await exists(path.join(childPath, 'SKILL.md')))) continue

    childCount += 1
    await installSkillDirectory(childPath, skillsDir, installed, skipped)
  }

  if (childCount === 0) {
    skipped.push(`${path.basename(source)} (missing SKILL.md)`)
  }
}

async function installExtractedZip(
  source: string,
  zipPath: string,
  skillsDir: string,
  installed: string[],
  skipped: string[],
) {
  if (await exists(path.join(source, 'SKILL.md'))) {
    const name = sanitizeSkillName(path.basename(zipPath, path.extname(zipPath)))
    await replaceDirectory(source, path.join(skillsDir, name))
    installed.push(name)
    return
  }

  const entries = await fs.readdir(source, { withFileTypes: true })
  let childCount = 0

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === '__MACOSX') continue
    const childPath = path.join(source, entry.name)
    if (!(await exists(path.join(childPath, 'SKILL.md')))) continue

    childCount += 1
    const name = sanitizeSkillName(entry.name)
    await replaceDirectory(childPath, path.join(skillsDir, name))
    installed.push(name)
  }

  if (childCount === 0) {
    skipped.push(`${path.basename(zipPath)} (zip missing SKILL.md)`)
  }
}

async function installSkillZip(
  zipPath: string,
  skillsDir: string,
  installed: string[],
  skipped: string[],
) {
  const tempDir = await fs.mkdtemp(path.join(app.getPath('temp'), 'claude-abay-skill-import-'))

  try {
    await extractZip(zipPath, { dir: tempDir })
    await installExtractedZip(tempDir, zipPath, skillsDir, installed, skipped)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

export async function installSkillsFromPaths(input: SkillInstallInput): Promise<SkillInstallResult> {
  const paths = Array.isArray(input.paths)
    ? input.paths.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
  const skillsDir = path.join(getClaudeConfigHomeDir(), 'skills')
  const installed: string[] = []
  const skipped: string[] = []

  await fs.mkdir(skillsDir, { recursive: true })

  for (const rawPath of paths) {
    const source = path.resolve(rawPath)
    if (!(await exists(source))) {
      skipped.push(`${source} (not found)`)
      continue
    }

    if (await isDirectory(source)) {
      await installSkillDirectory(source, skillsDir, installed, skipped)
      continue
    }

    if (path.extname(source).toLowerCase() === '.zip') {
      await installSkillZip(source, skillsDir, installed, skipped)
      continue
    }

    skipped.push(`${path.basename(source)} (unsupported file type)`)
  }

  installed.sort()
  skipped.sort()

  return {
    installed: [...new Set(installed)],
    skipped: [...new Set(skipped)],
    skillsDir,
  }
}
