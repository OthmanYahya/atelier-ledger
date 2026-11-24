import { validateImportPayload } from './storage'
import type { LedgerState } from './types'

export const SYNC_CONFIG_KEY = 'atelier-ledger.sync.v1'
export const DEFAULT_GIST_FILENAME = 'atelier-ledger.json'

export interface SyncConfig {
  token: string
  gistId: string
  filename: string
  autoSync: boolean
  lastSyncedAt?: string
  lastRemoteUpdatedAt?: string
}

export type SyncStateKind = 'idle' | 'syncing' | 'synced' | 'conflict' | 'error'

export interface SyncStatus {
  kind: SyncStateKind
  message: string
  remoteCandidate?: LedgerState
}

interface GitHubGistFile {
  filename?: string
  content?: string
  truncated?: boolean
  raw_url?: string
}

interface GitHubGistResponse {
  id: string
  updated_at?: string
  files?: Record<string, GitHubGistFile | undefined>
}

export function createDefaultSyncConfig(): SyncConfig {
  return {
    token: '',
    gistId: '',
    filename: DEFAULT_GIST_FILENAME,
    autoSync: true,
  }
}

export function loadSyncConfig(): SyncConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultSyncConfig()
  }
  try {
    const raw = window.localStorage.getItem(SYNC_CONFIG_KEY)
    if (!raw) return createDefaultSyncConfig()
    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    return {
      token: typeof parsed.token === 'string' ? parsed.token : '',
      gistId: typeof parsed.gistId === 'string' ? parsed.gistId : '',
      filename:
        typeof parsed.filename === 'string' && parsed.filename.trim()
          ? parsed.filename.trim()
          : DEFAULT_GIST_FILENAME,
      autoSync: parsed.autoSync !== false,
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined,
      lastRemoteUpdatedAt:
        typeof parsed.lastRemoteUpdatedAt === 'string' ? parsed.lastRemoteUpdatedAt : undefined,
    }
  } catch {
    return createDefaultSyncConfig()
  }
}

export function saveSyncConfig(config: SyncConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // ignore storage quota errors
  }
}

export function clearSyncConfig(): SyncConfig {
  const empty = createDefaultSyncConfig()
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(SYNC_CONFIG_KEY)
    } catch {
      // ignore
    }
  }
  return empty
}

function authHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.trim()}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function readGistResponse(
  gistId: string,
  token: string,
  filename: string,
  fetchImpl: typeof fetch,
): Promise<{ state: LedgerState; remoteStamp: string }> {
  const cleanId = gistId.trim()
  const res = await fetchImpl(`https://api.github.com/gists/${encodeURIComponent(cleanId)}`, {
    method: 'GET',
    headers: authHeaders(token),
  })
  if (!res.ok) {
    throw new Error(`GitHub Gist read failed (${res.status}). Check token & Gist ID.`)
  }
  const gist = (await res.json()) as GitHubGistResponse
  const file = gist.files?.[filename] ?? Object.values(gist.files ?? {})[0]
  if (!file) {
    throw new Error(`Gist "${cleanId}" contains no files.`)
  }
  let rawContent = file.content ?? ''
  if (file.truncated && file.raw_url) {
    const rawRes = await fetchImpl(file.raw_url)
    if (!rawRes.ok) {
      throw new Error(`Failed to fetch full Gist file (${rawRes.status}).`)
    }
    rawContent = await rawRes.text()
  }
  const validated = validateImportPayload(rawContent)
  if (!validated.ok) {
    throw new Error(`Remote Gist data failed validation: ${validated.error}`)
  }
  const remoteStamp = validated.state.updatedAt ?? gist.updated_at ?? ''
  return { state: validated.state, remoteStamp }
}

export async function pullFromGist(
  config: SyncConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ state: LedgerState; nextConfig: SyncConfig }> {
  if (!config.token.trim() || !config.gistId.trim()) {
    throw new Error('GitHub token and Gist ID are required to pull.')
  }
  const filename = config.filename.trim() || DEFAULT_GIST_FILENAME
  const { state, remoteStamp } = await readGistResponse(
    config.gistId,
    config.token,
    filename,
    fetchImpl,
  )
  const now = new Date().toISOString()
  return {
    state,
    nextConfig: {
      ...config,
      filename,
      lastSyncedAt: now,
      lastRemoteUpdatedAt: remoteStamp || now,
    },
  }
}

export async function createPrivateGist(
  state: LedgerState,
  token: string,
  filename = DEFAULT_GIST_FILENAME,
  fetchImpl: typeof fetch = fetch,
): Promise<{ gistId: string; updatedAt: string }> {
  if (!token.trim()) {
    throw new Error('GitHub Personal Access Token is required.')
  }
  const stamp = state.updatedAt ?? new Date().toISOString()
  const payload: LedgerState = { ...state, updatedAt: stamp }
  const res = await fetchImpl('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Atelier Ledger private workspace sync',
      public: false,
      files: {
        [filename]: { content: JSON.stringify(payload, null, 2) },
      },
    }),
  })
  if (!res.ok) {
    throw new Error(`Could not create private Gist (${res.status}). Check token 'gist' permission.`)
  }
  const created = (await res.json()) as GitHubGistResponse
  return {
    gistId: created.id,
    updatedAt: stamp,
  }
}

export type PushOutcome =
  | { kind: 'pushed'; nextConfig: SyncConfig; stamp: string }
  | { kind: 'conflict'; remoteState: LedgerState; remoteStamp: string; reason: string }

/** Push local state to an existing private Gist, aborting if remote changed since last sync. */
export async function pushToGist(
  state: LedgerState,
  config: SyncConfig,
  options: { force?: boolean } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<PushOutcome> {
  if (!config.token.trim() || !config.gistId.trim()) {
    throw new Error('GitHub token and Gist ID are required to push.')
  }
  const filename = config.filename.trim() || DEFAULT_GIST_FILENAME

  if (!options.force) {
    const remote = await readGistResponse(config.gistId, config.token, filename, fetchImpl)
    // Never silently clobber real remote data with untouched sample demo data,
    // and never overwrite changes pushed from another device since our last sync.
    if (state.demoLoaded && !remote.state.demoLoaded) {
      return {
        kind: 'conflict',
        remoteState: remote.state,
        remoteStamp: remote.remoteStamp,
        reason: 'Remote Gist holds real workspace data while this browser only has demo data.',
      }
    }
    if (
      remote.remoteStamp &&
      (!config.lastRemoteUpdatedAt || remote.remoteStamp > config.lastRemoteUpdatedAt)
    ) {
      return {
        kind: 'conflict',
        remoteState: remote.state,
        remoteStamp: remote.remoteStamp,
        reason: 'Remote Gist was updated on another device since your last sync.',
      }
    }
  }

  const stamp = new Date().toISOString()
  const payload: LedgerState = { ...state, updatedAt: stamp }
  const res = await fetchImpl(
    `https://api.github.com/gists/${encodeURIComponent(config.gistId.trim())}`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(tokenOrTrim(config.token)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          [filename]: { content: JSON.stringify(payload, null, 2) },
        },
      }),
    },
  )
  if (!res.ok) {
    throw new Error(`GitHub Gist push failed (${res.status}).`)
  }
  return {
    kind: 'pushed',
    stamp,
    nextConfig: {
      ...config,
      filename,
      lastSyncedAt: stamp,
      lastRemoteUpdatedAt: stamp,
    },
  }
}

function tokenOrTrim(token: string): string {
  return token.trim()
}
