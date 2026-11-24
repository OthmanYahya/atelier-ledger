import { useEffect, useState } from 'react'
import { Check, Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { useLedger } from '../context/LedgerContext'

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function TimerPill({ compact = false }: { compact?: boolean }) {
  const {
    state,
    startTimer,
    pauseTimer,
    resetTimer,
    finishTimerToLesson,
    setTimerTarget,
  } = useLedger()
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!state.timer.running) return
    setNowMs(Date.now())
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [state.timer.running])

  const elapsedMs =
    state.timer.accumulatedMs +
    (state.timer.running && state.timer.startedAtMs
      ? Math.max(0, nowMs - state.timer.startedAtMs)
      : 0)

  const activeStudents = state.students.filter((s) => s.status === 'Active')
  const selectedStudent = state.students.find((s) => s.id === state.timer.studentId)
  const hasElapsed = elapsedMs > 0 || state.timer.running

  if (compact) {
    if (!hasElapsed) return null
    return (
      <div
        className="no-print fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border px-3 py-1.5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-strong)',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: state.timer.running ? 'var(--terracotta)' : 'var(--ink-muted)' }}
        />
        <span className="font-mono-ledger text-[13px] font-semibold">
          {formatClock(elapsedMs)}
        </span>
        {selectedStudent && (
          <span className="max-w-28 truncate text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
            {selectedStudent.name}
          </span>
        )}
        <button
          type="button"
          onClick={() => (state.timer.running ? pauseTimer() : startTimer())}
          aria-label={state.timer.running ? 'Pause timer' : 'Resume timer'}
          className="rounded p-1 hover:opacity-80"
          style={{ color: 'var(--ink-primary)' }}
        >
          {state.timer.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={finishTimerToLesson}
          className="btn-primary px-2 py-0.5 text-[11px]"
        >
          Finish
        </button>
      </div>
    )
  }

  return (
    <section
      aria-label="Session timer"
      className="rounded-lg border p-3"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: state.timer.running ? 'var(--terracotta)' : 'var(--border)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--ink-secondary)' }}>
          <Timer className="h-3.5 w-3.5" strokeWidth={1.6} />
          <span>Session Timer</span>
        </div>
        {state.timer.running && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: 'var(--terracotta-tint)', color: 'var(--terracotta)' }}
          >
            Live
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono-ledger text-xl font-semibold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
          {formatClock(elapsedMs)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => (state.timer.running ? pauseTimer() : startTimer())}
            aria-label={state.timer.running ? 'Pause session timer' : 'Start session timer'}
            className="btn-secondary flex h-7 w-7 items-center justify-center p-0"
            title={state.timer.running ? 'Pause' : 'Start'}
          >
            {state.timer.running ? (
              <Pause className="h-3.5 w-3.5" strokeWidth={1.6} />
            ) : (
              <Play className="h-3.5 w-3.5" strokeWidth={1.6} />
            )}
          </button>
          {hasElapsed && (
            <>
              <button
                type="button"
                onClick={finishTimerToLesson}
                aria-label="Finish timer and log lesson"
                className="btn-primary flex h-7 items-center gap-1 px-2 text-[11px]"
                title="Finish & Log Lesson"
              >
                <Check className="h-3 w-3" strokeWidth={2} />
                <span>Log</span>
              </button>
              <button
                type="button"
                onClick={resetTimer}
                aria-label="Reset timer"
                className="btn-secondary flex h-7 w-7 items-center justify-center p-0"
                title="Reset"
              >
                <RotateCcw className="h-3 w-3" strokeWidth={1.6} />
              </button>
            </>
          )}
        </div>
      </div>

      <select
        aria-label="Timer student"
        value={state.timer.studentId ?? ''}
        onChange={(e) => setTimerTarget(e.target.value || undefined, undefined)}
        className="ledger-control mt-2 w-full px-2 py-1 text-[12px]"
      >
        <option value="">General / pick student…</option>
        {activeStudents.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </section>
  )
}
