export type ExtractionState = 'none' | 'extracting' | 'needPassword' | 'failed' | 'ok'

/** Derive archive extraction state from a JD package status string. */
export function extractionStateFromStatus(status?: string, finished?: boolean): ExtractionState {
  if (!status) return 'none'
  if (/password|wrong pass|crc/i.test(status)) return 'needPassword'
  if (/extract.*(fail|error)|unpack.*(fail|error)|archive.*(fail|error)/i.test(status)) return 'failed'
  if (/extracting|unpacking|extract\b|unpack\b/i.test(status)) {
    return finished ? 'ok' : 'extracting'
  }
  return 'none'
}

export function extractionBlocksMover(state: ExtractionState): boolean {
  return state === 'extracting' || state === 'needPassword' || state === 'failed'
}

/** True when JD no longer lists archives for the package (extracted or never had any). */
export function archivesListReady(archives: { archiveId?: string }[] | null | undefined): boolean {
  return !archives || archives.length === 0
}
