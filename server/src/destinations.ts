import { join } from 'node:path'
import { config } from './config.js'

export type DestinationKind = 'movies' | 'shows' | 'other'

export interface DestinationSpec {
  kind: DestinationKind
  /** Movie title, show name, or other package name. */
  title: string
  /** Season number when kind is shows. */
  season?: number
}

const STAGING_MOVIES = 'movies'
const STAGING_SHOWS = 'shows'
const STAGING_OTHER = 'downloads'

/** Folder JDownloader should write into for this destination. */
export function stagingPathFor(spec: DestinationSpec): string {
  const title = sanitizeSegment(spec.title)
  if (spec.kind === 'movies') {
    return join(config.stagingDir, STAGING_MOVIES, title)
  }
  if (spec.kind === 'shows') {
    const season = Math.max(1, Math.floor(spec.season ?? 1))
    return join(config.stagingDir, STAGING_SHOWS, title, `Season ${season}`)
  }
  return join(config.stagingDir, STAGING_OTHER, title || 'download')
}

/** Final library folder for a staging path under the configured staging root. */
export function libraryPathForStaging(stagingAbsolute: string): string | null {
  const root = config.stagingDir.replace(/\/+$/, '')
  if (!stagingAbsolute.startsWith(root + '/') && stagingAbsolute !== root) return null
  const rel = stagingAbsolute.slice(root.length).replace(/^\/+/, '')
  const parts = rel.split('/').filter(Boolean)
  if (parts[0] === STAGING_MOVIES && parts.length >= 2) {
    return join(config.moviesDir, parts.slice(1).join('/'))
  }
  if (parts[0] === STAGING_SHOWS && parts.length >= 2) {
    return join(config.showsDir, parts.slice(1).join('/'))
  }
  if (parts[0] === STAGING_OTHER && parts.length >= 2) {
    return join(config.otherDir, parts.slice(1).join('/'))
  }
  return null
}

export function describeDestination(stagingAbsolute: string): string | null {
  const root = config.stagingDir.replace(/\/+$/, '')
  if (!stagingAbsolute.startsWith(root + '/') && stagingAbsolute !== root) return null
  const rel = stagingAbsolute.slice(root.length).replace(/^\/+/, '')
  const parts = rel.split('/').filter(Boolean)
  if (parts[0] === STAGING_MOVIES && parts[1]) return `Movies / ${parts.slice(1).join(' / ')}`
  if (parts[0] === STAGING_SHOWS && parts[1]) return `Series / ${parts.slice(1).join(' / ')}`
  if (parts[0] === STAGING_OTHER && parts[1]) return `Other / ${parts.slice(1).join(' / ')}`
  return null
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/[<>:"|?*\u0000-\u001f]/g, '')
    .replace(/[/\\]+/g, ' - ')
    .replace(/\s+/g, ' ')
    .slice(0, 180)
}
