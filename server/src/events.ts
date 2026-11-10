import { jdCall, probeJdApi } from './jd.js'
import { getAppSettings } from './settings.js'
import { log } from './log.js'
import { dispatchWebhook } from './webhooks.js'

export type JdStatusEvent = { ok: true } | { ok: false; error: string }

export type DownloadsEvent = {
  links: unknown[]
  packages: unknown[]
  engineState: string
}

export type GrabberEvent = { links: unknown[] }

export type DialogInfo = {
  id: number
  type: string
  properties?: Record<string, string>
}

export type DialogsEvent = { dialogs: DialogInfo[] }

type EventName = 'downloads' | 'grabber' | 'dialogs' | 'jd.status' | 'heartbeat'

type SseClient = {
  id: number
  write: (event: EventName, data: unknown) => Promise<void>
}

const LINK_QUERY = {
  bytesTotal: true,
  bytesLoaded: true,
  host: true,
  speed: true,
  eta: true,
  status: true,
  enabled: true,
  running: true,
  finished: true,
  url: false,
}

const PKG_QUERY = {
  bytesTotal: true,
  bytesLoaded: true,
  saveTo: true,
  comment: true,
  status: true,
  finished: true,
  enabled: true,
  hosts: true,
  speed: true,
  eta: true,
}

const GRABBER_QUERY = {
  bytesTotal: true,
  host: true,
  availability: true,
  enabled: true,
  url: true,
}

const clients = new Set<SseClient>()
let nextClientId = 1
let timer: ReturnType<typeof setInterval> | null = null
let tickInFlight = false

let lastDownloads: DownloadsEvent | null = null
let lastGrabber: GrabberEvent | null = null
let lastDialogs: DialogsEvent | null = null
let lastStatus: JdStatusEvent | null = null
/** Package uuids already reported as finished for download.finished webhooks. */
let prevFinished = new Set<number>()

type FinishedPackage = { uuid?: number; name?: string; saveTo?: string; finished?: boolean }

function noteFinishedPackages(packages: unknown[]): void {
  const pkgs = packages as FinishedPackage[]
  for (const pkg of pkgs) {
    if (!pkg.finished || pkg.uuid == null || prevFinished.has(pkg.uuid)) continue
    void dispatchWebhook({
      event: 'download.finished',
      at: new Date().toISOString(),
      package: { uuid: pkg.uuid, name: pkg.name ?? '', saveTo: pkg.saveTo },
    })
  }
  prevFinished = new Set(
    pkgs.filter((p) => p.finished && p.uuid != null).map((p) => p.uuid as number),
  )
}

function eventsIntervalMs(): number {
  const raw = process.env.JDWEB2_EVENTS_INTERVAL_MS
  const n = raw ? Number(raw) : 2000
  if (!Number.isFinite(n)) return 2000
  return Math.max(500, Math.min(10_000, n))
}

async function broadcast(event: EventName, data: unknown): Promise<void> {
  const dead: SseClient[] = []
  for (const client of clients) {
    try {
      await client.write(event, data)
    } catch {
      dead.push(client)
    }
  }
  for (const client of dead) clients.delete(client)
  if (clients.size === 0) stopPoller()
}

async function loadDialogs(): Promise<DialogInfo[]> {
  const ids = (await jdCall<number[] | null>('/dialogs/list')) ?? []
  const out: DialogInfo[] = []
  for (const id of ids) {
    try {
      const dialog = await jdCall<{ type: string; properties?: Record<string, string> }>(
        '/dialogs/get',
        id,
        true,
      )
      out.push({ id, type: dialog.type ?? '', properties: dialog.properties })
    } catch {
      out.push({ id, type: 'unknown' })
    }
  }
  return out
}

async function tick(): Promise<void> {
  if (tickInFlight || clients.size === 0) return
  tickInFlight = true
  try {
    const [links, packages, engineState, grabberLinks, dialogs] = await Promise.all([
      jdCall<unknown[]>('/downloadsV2/queryLinks', LINK_QUERY),
      jdCall<unknown[]>('/downloadsV2/queryPackages', PKG_QUERY),
      jdCall<string>('/downloadcontroller/getCurrentState'),
      jdCall<unknown[]>('/linkgrabberv2/queryLinks', GRABBER_QUERY),
      loadDialogs(),
    ])
    lastDownloads = {
      links: links ?? [],
      packages: packages ?? [],
      engineState: engineState ?? 'UNKNOWN',
    }
    lastGrabber = { links: grabberLinks ?? [] }
    lastDialogs = { dialogs }
    lastStatus = { ok: true }
    noteFinishedPackages(lastDownloads.packages)
    await broadcast('downloads', lastDownloads)
    await broadcast('grabber', lastGrabber)
    await broadcast('dialogs', lastDialogs)
    await broadcast('jd.status', lastStatus)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unreachable'
    lastStatus = { ok: false, error: message }
    lastDownloads = { links: [], packages: [], engineState: 'UNKNOWN' }
    lastGrabber = { links: [] }
    lastDialogs = { dialogs: [] }
    await broadcast('downloads', lastDownloads)
    await broadcast('grabber', lastGrabber)
    await broadcast('dialogs', lastDialogs)
    await broadcast('jd.status', lastStatus)
    // Keep probing lightly so reconnect is noticed without hammering.
    const probe = await probeJdApi(getAppSettings().jdApiUrl)
    if (probe.ok) {
      log('info', 'jd reachable again after events error')
    }
  } finally {
    tickInFlight = false
  }
}

function startPoller(): void {
  if (timer) return
  const ms = eventsIntervalMs()
  log('info', 'sse poller started', { intervalMs: ms })
  void tick()
  timer = setInterval(() => void tick(), ms)
}

function stopPoller(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
  log('info', 'sse poller stopped')
}

export function addEventsClient(write: SseClient['write']): SseClient {
  const client: SseClient = { id: nextClientId++, write }
  clients.add(client)
  startPoller()
  return client
}

export function removeEventsClient(client: SseClient): void {
  clients.delete(client)
  if (clients.size === 0) stopPoller()
}

/** Push the latest cached snapshot to a newly connected client. */
export async function sendEventsSnapshot(write: SseClient['write']): Promise<void> {
  if (lastStatus) await write('jd.status', lastStatus)
  if (lastDownloads) await write('downloads', lastDownloads)
  if (lastGrabber) await write('grabber', lastGrabber)
  if (lastDialogs) await write('dialogs', lastDialogs)
}

export function eventsClientCount(): number {
  return clients.size
}
