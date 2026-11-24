import { useRef, useState } from 'react'
import { Cloud, CloudOff, Download, Eraser, RefreshCw, RotateCcw, Upload } from 'lucide-react'
import { useLedger } from '../context/LedgerContext'
import {
  buildStudentBillingLedgers,
  computeLessonCharge,
} from '../domain/billing'
import { minorToEditableString, parseMajorToMinor } from '../domain/money'
import {
  downloadTextFile,
  exportExpensesCSV,
  exportLessonsCSV,
  validateImportPayload,
} from '../domain/storage'

const COMMON_CURRENCIES = ['USD', 'IQD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']

export function SettingsView() {
  const {
    state,
    today,
    updateSettings,
    clearDemoData,
    reloadDemoData,
    replaceImportedState,
    syncConfig,
    syncStatus,
    updateSyncConfig,
    syncCreatePrivateGist,
    syncPullNow,
    syncPushNow,
    syncDisconnect,
    acceptRemoteConflict,
  } = useLedger()

  const cur = state.settings.currency
  const [currencyInput, setCurrencyInput] = useState(cur)
  const [rateInput, setRateInput] = useState(
    minorToEditableString(state.settings.defaultHourlyRateMinor, cur),
  )
  const [durationInput, setDurationInput] = useState(
    String(state.settings.defaultLessonDurationMin),
  )
  const [workStart, setWorkStart] = useState(state.settings.workingHoursStart)
  const [workEnd, setWorkEnd] = useState(state.settings.workingHoursEnd)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCur = currencyInput.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(cleanCur)) {
      setFeedback({ kind: 'err', msg: 'Enter a valid 3-letter ISO currency code (e.g. USD, IQD, EUR).' })
      return
    }
    const rateMinor = Math.max(0, parseMajorToMinor(rateInput, cleanCur))
    const dur = Math.max(5, Number.parseInt(durationInput, 10) || 60)
    updateSettings({
      currency: cleanCur,
      defaultHourlyRateMinor: rateMinor,
      defaultLessonDurationMin: dur,
      workingHoursStart: workStart,
      workingHoursEnd: workEnd,
    })
    setFeedback({ kind: 'ok', msg: 'Workspace settings saved.' })
  }

  const handleExportJSON = () => {
    downloadTextFile(
      `atelier-ledger-backup-${today}.json`,
      JSON.stringify(state, null, 2),
      'application/json',
    )
    setFeedback({ kind: 'ok', msg: 'Full JSON backup exported.' })
  }

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    const validated = validateImportPayload(text)
    if (!validated.ok) {
      setFeedback({ kind: 'err', msg: `Import rejected: ${validated.error}` })
      return
    }
    replaceImportedState(validated.state)
    setCurrencyInput(validated.state.settings.currency)
    setRateInput(
      minorToEditableString(
        validated.state.settings.defaultHourlyRateMinor,
        validated.state.settings.currency,
      ),
    )
    setDurationInput(String(validated.state.settings.defaultLessonDurationMin))
    setWorkStart(validated.state.settings.workingHoursStart)
    setWorkEnd(validated.state.settings.workingHoursEnd)
    setFeedback({ kind: 'ok', msg: 'Backup validated and restored cleanly.' })
  }

  const handleExportLessonsCSV = () => {
    const { retainerLedgers, packageLedgers } = buildStudentBillingLedgers(
      state.students,
      state.lessons,
      state.retainerPayments,
      today,
    )
    const csv = exportLessonsCSV(state.lessons, state.students, state.settings, (l, s) =>
      computeLessonCharge(
        s,
        l,
        s ? retainerLedgers.get(s.id) : undefined,
        s ? packageLedgers.get(s.id) : undefined,
      ).effectivePriceMinor,
    )
    downloadTextFile(`atelier-lessons-${today}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const handleExportExpensesCSV = () => {
    const csv = exportExpensesCSV(state.expenses, state.students, state.settings)
    downloadTextFile(`atelier-expenses-${today}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const syncBusy = syncStatus.kind === 'syncing'

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings &amp; Backups</h1>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
          Configure currency, cross-device Private GitHub Gist sync, JSON backups, and CSV exports.
        </p>
      </div>

      {feedback && (
        <div
          className="rounded-lg border px-4 py-2.5 text-[13px]"
          style={{
            backgroundColor: feedback.kind === 'ok' ? 'var(--sage-tint)' : 'var(--crimson-tint)',
            borderColor: feedback.kind === 'ok' ? 'var(--sage)' : 'var(--crimson)',
            color: feedback.kind === 'ok' ? 'var(--sage)' : 'var(--crimson)',
          }}
        >
          {feedback.msg}
        </div>
      )}

      {/* Cross-Device Sync (IndexedDB + Private GitHub Gist) */}
      <section className="ledger-sheet space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="font-display text-xl font-semibold">Cross-Device Sync (Private GitHub Gist)</h2>
          </div>
          {syncConfig.lastSyncedAt && (
            <span className="tabular-nums text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              Last synced: {syncConfig.lastSyncedAt.slice(0, 16).replace('T', ' ')} UTC
            </span>
          )}
        </div>

        <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
          Data saves locally in IndexedDB with multi-megabyte capacity. Connect a Private GitHub Gist with a Personal Access Token (with <code className="font-mono-ledger">gist</code> scope) to sync seamlessly across laptops and phones when hosted on GitHub Pages. Your token stays in this browser only.
        </p>

        {syncStatus.message && (
          <div
            className="rounded-md border px-3 py-2 text-[12px]"
            style={{
              backgroundColor:
                syncStatus.kind === 'error'
                  ? 'var(--crimson-tint)'
                  : syncStatus.kind === 'conflict'
                    ? 'var(--terracotta-tint)'
                    : 'var(--bg-rail)',
              borderColor:
                syncStatus.kind === 'error'
                  ? 'var(--crimson)'
                  : syncStatus.kind === 'conflict'
                    ? 'var(--terracotta)'
                    : 'var(--border-strong)',
              color:
                syncStatus.kind === 'error'
                  ? 'var(--crimson)'
                  : syncStatus.kind === 'conflict'
                    ? 'var(--terracotta)'
                    : 'var(--ink-primary)',
            }}
          >
            <div>{syncStatus.message}</div>
            {syncStatus.kind === 'conflict' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={acceptRemoteConflict}
                  className="btn-primary px-3 py-1 text-[11px]"
                >
                  Use Cloud Gist Data
                </button>
                <button
                  type="button"
                  onClick={() => void syncPushNow(true)}
                  className="btn-secondary px-3 py-1 text-[11px]"
                >
                  Overwrite Cloud with This Device
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={syncConfig.token}
              onChange={(e) => updateSyncConfig({ token: e.target.value })}
              placeholder="ghp_… or github_pat_…"
              className="ledger-control font-mono-ledger w-full px-3 py-1.5 text-[12px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Private Gist ID (blank on first device to create one)
            </label>
            <input
              type="text"
              value={syncConfig.gistId}
              onChange={(e) => updateSyncConfig({ gistId: e.target.value })}
              placeholder="e.g. a1b2c3d4e5f6…"
              className="ledger-control font-mono-ledger w-full px-3 py-1.5 text-[12px]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={syncConfig.autoSync}
              onChange={(e) => updateSyncConfig({ autoSync: e.target.checked })}
            />
            <span>Auto-pull on open &amp; push edits automatically</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {!syncConfig.gistId.trim() ? (
              <button
                type="button"
                disabled={syncBusy || !syncConfig.token.trim()}
                onClick={() => void syncCreatePrivateGist()}
                className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px]"
              >
                <Cloud className="h-3.5 w-3.5" />
                <span>Create Private Gist &amp; Sync</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={syncBusy || !syncConfig.token.trim()}
                  onClick={() => void syncPullNow()}
                  className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Pull from Gist</span>
                </button>
                <button
                  type="button"
                  disabled={syncBusy || !syncConfig.token.trim()}
                  onClick={() => void syncPushNow(false)}
                  className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
                >
                  <Cloud className="h-3.5 w-3.5" />
                  <span>Push to Gist</span>
                </button>
                <button
                  type="button"
                  onClick={syncDisconnect}
                  className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px]"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  <CloudOff className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <form onSubmit={handleSaveSettings} className="ledger-sheet space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">Studio Defaults</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Currency (ISO 4217)
            </label>
            <div className="flex gap-2">
              <select
                aria-label="Preset currency"
                value={COMMON_CURRENCIES.includes(currencyInput) ? currencyInput : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') setCurrencyInput(e.target.value)
                }}
                className="ledger-control px-2.5 py-1.5 text-[13px]"
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              <input
                type="text"
                maxLength={3}
                value={currencyInput}
                onChange={(e) => setCurrencyInput(e.target.value.toUpperCase())}
                aria-label="Currency code"
                className="ledger-control font-mono-ledger w-24 px-2.5 py-1.5 text-[13px] uppercase"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Default Hourly Rate ({currencyInput || cur})
            </label>
            <input
              type="text"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              className="ledger-control tabular-nums w-full px-3 py-1.5 text-[13px]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Default Lesson Duration (minutes)
            </label>
            <input
              type="number"
              min={5}
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              className="ledger-control tabular-nums w-full px-3 py-1.5 text-[13px]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Working Hours
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="ledger-control tabular-nums flex-1 px-2.5 py-1.5 text-[13px]"
              />
              <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                to
              </span>
              <input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="ledger-control tabular-nums flex-1 px-2.5 py-1.5 text-[13px]"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
              Surface Theme:
            </span>
            <button
              type="button"
              onClick={() => updateSettings({ theme: 'paper' })}
              className="rounded border px-2.5 py-1 text-[12px]"
              style={{
                backgroundColor: state.settings.theme === 'paper' ? 'var(--accent)' : 'var(--bg-surface)',
                color: state.settings.theme === 'paper' ? 'var(--accent-ink)' : 'var(--ink-secondary)',
                borderColor: state.settings.theme === 'paper' ? 'var(--accent)' : 'var(--border)',
              }}
            >
              Archival Paper
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ theme: 'ink' })}
              className="rounded border px-2.5 py-1 text-[12px]"
              style={{
                backgroundColor: state.settings.theme === 'ink' ? 'var(--accent)' : 'var(--bg-surface)',
                color: state.settings.theme === 'ink' ? 'var(--accent-ink)' : 'var(--ink-secondary)',
                borderColor: state.settings.theme === 'ink' ? 'var(--accent)' : 'var(--border)',
              }}
            >
              Ink Dark
            </button>
          </div>

          <button type="submit" className="btn-primary px-4 py-1.5 text-[13px]">
            Save Defaults
          </button>
        </div>
      </form>

      {/* Backups & CSV Exports */}
      <section className="ledger-sheet space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">Portability &amp; Backups</h2>
        <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
          Export versioned JSON snapshots or CSV spreadsheets anytime for offline archiving.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleExportJSON}
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px]"
          >
            <Download className="h-4 w-4" />
            <span>Export JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px]"
          >
            <Upload className="h-4 w-4" />
            <span>Import JSON Backup</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportJSON}
            className="hidden"
          />

          <button
            type="button"
            onClick={handleExportLessonsCSV}
            className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px]"
          >
            <Download className="h-4 w-4" />
            <span>Export Lessons CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportExpensesCSV}
            className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px]"
          >
            <Download className="h-4 w-4" />
            <span>Export Expenses CSV</span>
          </button>
        </div>
      </section>

      {/* Demo Data Controls */}
      <section className="ledger-sheet space-y-3 p-5">
        <h2 className="font-display text-xl font-semibold">Demo &amp; Reset</h2>
        <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
          Clear the preloaded sample studio or reload fresh demo records for exploration.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => {
              clearDemoData()
              setFeedback({ kind: 'ok', msg: 'Workspace cleared. Ready for your own students and tasks.' })
            }}
            className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px]"
            style={{ color: 'var(--crimson)' }}
          >
            <Eraser className="h-4 w-4" />
            <span>Clear Demo Data / Start Fresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              reloadDemoData()
              setFeedback({ kind: 'ok', msg: 'Sample studio data loaded.' })
            }}
            className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px]"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Restore Sample Studio Data</span>
          </button>
        </div>
      </section>
    </div>
  )
}
