import { describe, expect, it, vi } from 'vitest'
import { createPrivateGist, pullFromGist, pushToGist, type SyncConfig } from './gistSync'
import { createDemoLedgerState, createEmptyLedgerState } from './storage'

describe('GitHub Gist sync', () => {
  const baseConfig: SyncConfig = {
    token: 'ghp_test_token',
    gistId: 'gist123',
    filename: 'atelier-ledger.json',
    autoSync: true,
    lastRemoteUpdatedAt: '2026-11-24T10:00:00.000Z',
  }

  it('pulls and validates remote state cleanly', async () => {
    const remoteState = {
      ...createEmptyLedgerState(),
      updatedAt: '2026-11-24T12:00:00.000Z',
    }
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'gist123',
          updated_at: '2026-11-24T12:00:00.000Z',
          files: {
            'atelier-ledger.json': { content: JSON.stringify(remoteState) },
          },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch

    const res = await pullFromGist(baseConfig, fetchMock)
    expect(res.state.demoLoaded).toBe(false)
    expect(res.nextConfig.lastRemoteUpdatedAt).toBe('2026-11-24T12:00:00.000Z')
  })

  it('aborts push with conflict if remote Gist is newer or holds real data over local demo', async () => {
    const newerRemote = {
      ...createEmptyLedgerState(),
      updatedAt: '2026-11-24T15:00:00.000Z',
    }
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'gist123',
          files: {
            'atelier-ledger.json': { content: JSON.stringify(newerRemote) },
          },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch

    const demoLocal = createDemoLedgerState('2026-11-24')
    const outcome = await pushToGist(demoLocal, baseConfig, {}, fetchMock)
    expect(outcome.kind).toBe('conflict')
    expect(fetchMock).toHaveBeenCalledTimes(1) // PATCH was never issued

    const realLocal = { ...createEmptyLedgerState(), updatedAt: '2026-11-24T14:00:00.000Z' }
    const conflictOutcome = await pushToGist(realLocal, baseConfig, {}, fetchMock)
    expect(conflictOutcome.kind).toBe('conflict')
  })

  it('creates a private (public: false) gist and pushes when remote matches last sync', async () => {
    const state = { ...createEmptyLedgerState(), updatedAt: '2026-11-24T10:00:00.000Z' }
    const postFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.public).toBe(false)
      return new Response(JSON.stringify({ id: 'newgist456' }), { status: 201 })
    }) as unknown as typeof fetch

    const created = await createPrivateGist(state, 'ghp_test', 'atelier-ledger.json', postFetch)
    expect(created.gistId).toBe('newgist456')

    const syncFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return new Response(JSON.stringify({ id: 'gist123' }), { status: 200 })
      }
      return new Response(
        JSON.stringify({
          id: 'gist123',
          files: {
            'atelier-ledger.json': { content: JSON.stringify(state) },
          },
        }),
        { status: 200 },
      )
    }) as unknown as typeof fetch

    const pushed = await pushToGist(state, baseConfig, {}, syncFetch)
    expect(pushed.kind).toBe('pushed')
    expect(syncFetch).toHaveBeenCalledTimes(2)
  })

  it('rejects malformed remote Gist content before returning state', async () => {
    const badFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'gist123',
          files: { 'atelier-ledger.json': { content: '{"schemaVersion":999}' } },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch

    await expect(pullFromGist(baseConfig, badFetch)).rejects.toThrow(/validation/i)
  })
})
