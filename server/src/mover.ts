import { cp, mkdir, rename, rm, stat, access } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import { constants } from 'node:fs'
import { config } from './config.js'
import { jdCall } from './jd.js'
import { libraryPathForStaging } from './destinations.js'
import { recordMoveEvent } from './move-history.js'
import { dispatchWebhook } from './webhooks.js'

interface PackageInfo {
  uuid: number
  name: string
  saveTo?: string
  bytesTotal?: number
  bytesLoaded?: number
  finished?: boolean
  status?: string
  comment?: string
}

interface ArchiveInfo {
  archiveId: string
}

let timer: ReturnType<typeof setInterval> | null = null
let running = false
/** Avoid spamming the console while JDownloader is offline. */
let jdReachable: boolean | null = null

export function startMover(): void {
  if (config.moverIntervalMs <= 0) return
  if (timer) return
  void tick()
  timer = setInterval(() => void tick(), config.moverIntervalMs)
}

export function stopMover(): void {
  if (timer) clearInterval(timer)
  timer = null
}

export type MoverRunResult = { moved: number; failed: number }

async function tick(): Promise<void> {
  if (running) return
  running = true
  try {
    await processFinishedPackages()
    if (jdReachable === false) {
      console.log('[mover] JDownloader is reachable again')
    }
    jdReachable = true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const offline = /fetch failed|unreachable|ECONNREFUSED|ENOTFOUND|503/i.test(message)
    if (offline) {
      if (jdReachable !== false) {
        console.warn(`[mover] JDownloader unreachable (${config.jdApiUrl}); will keep trying quietly`)
      }
      jdReachable = false
    } else {
      console.error('[mover]', message)
    }
  } finally {
    running = false
  }
}

/** Run one mover pass immediately (same logic as the interval tick). */
export async function runMoverNow(): Promise<MoverRunResult> {
  if (running) throw new Error('mover_busy')
  running = true
  try {
    const result = await processFinishedPackages()
    jdReachable = true
    return result
  } finally {
    running = false
  }
}

async function processFinishedPackages(): Promise<MoverRunResult> {
  const packages = await jdCall<PackageInfo[]>('/downloadsV2/queryPackages', {
    bytesTotal: true,
    bytesLoaded: true,
    saveTo: true,
    status: true,
    finished: true,
    comment: true,
  })
  let moved = 0
  let failed = 0
  for (const pkg of packages ?? []) {
    if (!pkg.finished || !pkg.saveTo) continue
    const target = libraryPathForStaging(pkg.saveTo)
    if (!target) continue
    if (pkg.comment?.startsWith('jdweb-mover:')) continue
    try {
      const ready = await archivesReady(pkg.uuid)
      if (!ready) continue
      await moveTree(pkg.saveTo, target)
      await jdCall('/downloadsV2/removeLinks', [], [pkg.uuid])
      recordMoveEvent({
        packageName: pkg.name,
        fromPath: pkg.saveTo,
        toPath: target,
        status: 'succeeded',
      })
      void dispatchWebhook({
        event: 'mover.succeeded',
        at: new Date().toISOString(),
        package: { uuid: pkg.uuid, name: pkg.name, saveTo: target },
      })
      moved += 1
    } catch (err) {
      failed += 1
      const message = err instanceof Error ? err.message : String(err)
      recordMoveEvent({
        packageName: pkg.name,
        fromPath: pkg.saveTo,
        toPath: target,
        status: 'failed',
        error: message,
      })
      void dispatchWebhook({
        event: 'mover.failed',
        at: new Date().toISOString(),
        package: { uuid: pkg.uuid, name: pkg.name, saveTo: pkg.saveTo },
        error: message,
      })
      try {
        await jdCall('/downloadsV2/setComment', `jdweb-mover: ${message}`, [], [pkg.uuid])
      } catch {
        /* ignore comment failures */
      }
    }
  }
  return { moved, failed }
}

async function archivesReady(packageUuid: number): Promise<boolean> {
  try {
    const archives = await jdCall<ArchiveInfo[]>('/extraction/getArchiveInfo', [], [packageUuid])
    if (!archives || archives.length === 0) return true
    // When archives remain listed without a successful extraction path, skip.
    // JD removes archive entries after successful extract when configured to delete archives.
    return archives.every((a) => Boolean(a.archiveId))
  } catch {
    return true
  }
}

async function moveTree(source: string, destination: string): Promise<void> {
  await access(source, constants.R_OK)
  try {
    await access(destination, constants.F_OK)
    throw new Error(`destination already exists: ${destination}`)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  await mkdir(dirname(destination), { recursive: true })
  const tmp = join(dirname(destination), `.jdweb-tmp-${basename(destination)}-${Date.now()}`)
  try {
    await cp(source, tmp, { recursive: true })
    await rename(tmp, destination)
  } catch (err) {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined)
    throw err
  }
  await rm(source, { recursive: true, force: true })
}

/** Move one package folder immediately (UI “change destination” / force move). */
export async function movePackageNow(packageUuid: number, newStagingDir: string): Promise<void> {
  const packages = await jdCall<PackageInfo[]>('/downloadsV2/queryPackages', {
    saveTo: true,
  })
  const pkg = (packages ?? []).find((p) => p.uuid === packageUuid)
  if (!pkg?.saveTo) throw new Error('package not found')

  await mkdir(newStagingDir, { recursive: true })
  const st = await stat(pkg.saveTo).catch(() => null)
  if (st?.isDirectory()) {
    const entries = await import('node:fs/promises').then((m) => m.readdir(pkg.saveTo!))
    for (const name of entries) {
      const from = join(pkg.saveTo!, name)
      const to = join(newStagingDir, name)
      await rename(from, to).catch(async () => {
        await cp(from, to, { recursive: true })
        await rm(from, { recursive: true, force: true })
      })
    }
    await rm(pkg.saveTo, { recursive: true, force: true }).catch(() => undefined)
  }

  await jdCall('/downloadsV2/setDownloadDirectory', newStagingDir, [packageUuid])
  const target = libraryPathForStaging(newStagingDir)
  if (target) {
    // Directory change only; automatic mover picks up when finished.
  }
}
