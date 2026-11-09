import { jdCall } from './http'

export interface DownloadLink {
  uuid: number
  name: string
  packageUUID: number
  bytesTotal?: number
  bytesLoaded?: number
  host?: string
  speed?: number
  eta?: number
  status?: string
  enabled?: boolean
  running?: boolean
  finished?: boolean
}

export interface PackageInfo {
  uuid: number
  name: string
  bytesTotal?: number
  bytesLoaded?: number
  saveTo?: string
  comment?: string
  status?: string
  finished?: boolean
  enabled?: boolean
  hosts?: string[]
  speed?: number
  eta?: number
}

export interface GrabberLink {
  uuid: number
  name: string
  packageUUID: number
  bytesTotal?: number
  host?: string
  availability?: string
  enabled?: boolean
  url?: string
}

export interface Account {
  uuid: number
  hostname: string
  username: string
  enabled: boolean
  valid?: boolean
  errorString?: string
  trafficLeft?: number
  trafficMax?: number
  status?: string
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

export function getJdVersion() {
  return jdCall<number>('/jd/version')
}

export function queryLinks() {
  return jdCall<DownloadLink[]>('/downloadsV2/queryLinks', LINK_QUERY)
}

export function queryPackages() {
  return jdCall<PackageInfo[]>('/downloadsV2/queryPackages', PKG_QUERY)
}

export function getControllerState() {
  return jdCall<string>('/downloadcontroller/getCurrentState')
}

export function startController() {
  return jdCall<boolean>('/downloadcontroller/start')
}

export function stopController() {
  return jdCall<boolean>('/downloadcontroller/stop')
}

export function setLinksEnabled(enabled: boolean, linkIds: number[]) {
  return jdCall('/downloadsV2/setEnabled', enabled, linkIds, [])
}

export function removeLinks(linkIds: number[], packageIds: number[] = []) {
  return jdCall('/downloadsV2/removeLinks', linkIds, packageIds)
}

export function forceDownload(linkIds: number[]) {
  return jdCall('/downloadsV2/forceDownload', linkIds, [])
}

export function cleanupFinished() {
  return jdCall(
    '/downloadsV2/cleanup',
    'DELETE_FINISHED',
    'REMOVE_LINKS_ONLY',
    'ALL',
    [],
    [],
  )
}

export function queryGrabberLinks() {
  return jdCall<GrabberLink[]>('/linkgrabberv2/queryLinks', {
    bytesTotal: true,
    host: true,
    availability: true,
    enabled: true,
    url: true,
  })
}

export function addLinks(payload: {
  links?: string
  dataURLs?: string[]
  destinationFolder?: string
  overwritePackagizerRules?: boolean
  autostart?: boolean
  packageName?: string
  assignJobID?: boolean
}) {
  return jdCall<{ id: number }>('/linkgrabberv2/addLinks', {
    ...(payload.links ? { links: payload.links } : {}),
    ...(payload.dataURLs?.length ? { dataURLs: payload.dataURLs } : {}),
    destinationFolder: payload.destinationFolder,
    overwritePackagizerRules: payload.overwritePackagizerRules ?? true,
    autostart: payload.autostart ?? false,
    packageName: payload.packageName,
    assignJobID: payload.assignJobID ?? true,
  })
}

/** Read a .dlc (or similar) container as the data URL JD expects. */
export function containerDataUrl(file: File): Promise<string> {
  const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      resolve(`data:application/${extension};base64,${url.slice(url.indexOf(',') + 1)}`)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export const CONTAINER_EXTENSIONS = ['.dlc']

export function moveGrabberToDownloads(linkIds: number[], packageIds: number[] = []) {
  return jdCall('/linkgrabberv2/moveToDownloadlist', linkIds, packageIds)
}

export function removeGrabberLinks(linkIds: number[], packageIds: number[] = []) {
  return jdCall('/linkgrabberv2/removeLinks', linkIds, packageIds)
}

export function listAccounts() {
  return jdCall<Account[]>('/accountsV2/listAccounts', {
    username: true,
    hostname: true,
    enabled: true,
    valid: true,
    errorString: true,
    trafficLeft: true,
    trafficMax: true,
    status: true,
  })
}

export function addAccount(hoster: string, username: string, password: string) {
  return jdCall('/accountsV2/addAccount', hoster, username, password)
}

export function removeAccounts(ids: number[]) {
  return jdCall('/accountsV2/removeAccounts', ids)
}

export function enableAccounts(ids: number[]) {
  return jdCall('/accountsV2/enableAccounts', ids)
}

export function disableAccounts(ids: number[]) {
  return jdCall('/accountsV2/disableAccounts', ids)
}

export function refreshAccounts(ids: number[]) {
  return jdCall('/accountsV2/refreshAccounts', ids)
}

const GENERAL = 'org.jdownloader.settings.GeneralSettings'
const EXTRACTION = 'org.jdownloader.extensions.extraction.ExtractionExtension'

export function getConfig<T>(storage: string | null, key: string) {
  return jdCall<T>('/config/get', GENERAL, storage, key)
}

export function setConfig(storage: string | null, key: string, value: unknown) {
  return jdCall<boolean>('/config/set', GENERAL, storage, key, value)
}

export function getMaxSimultDownloads() {
  return getConfig<number>(null, 'MaxSimultDownloads')
}

export function setMaxSimultDownloads(n: number) {
  return setConfig(null, 'MaxSimultDownloads', n)
}

export function getMaxChunks() {
  return getConfig<number>(null, 'MaxChunksPerFile')
}

export function setMaxChunks(n: number) {
  return setConfig(null, 'MaxChunksPerFile', n)
}

export function getMaxPerHost() {
  return getConfig<number>(null, 'MaxSimultDownloadsPerHost')
}

export function setMaxPerHost(n: number) {
  return setConfig(null, 'MaxSimultDownloadsPerHost', n)
}

export function getSpeedLimit() {
  return getConfig<number>(null, 'SpeedLimit')
}

export function setSpeedLimit(n: number) {
  return setConfig(null, 'SpeedLimit', n)
}

export function getPasswordList() {
  return jdCall<string[] | null>('/config/get', EXTRACTION, null, 'PasswordList')
}

export function setPasswordList(passwords: string[]) {
  return jdCall<boolean>('/config/set', EXTRACTION, null, 'PasswordList', passwords)
}

export function listDialogs() {
  return jdCall<number[] | null>('/dialogs/list')
}

export function getDialog(id: number) {
  return jdCall<{ type: string; properties?: Record<string, string> }>('/dialogs/get', id, true)
}

export function answerDialog(id: number, data: Record<string, unknown>) {
  return jdCall('/dialogs/answer', id, data)
}
