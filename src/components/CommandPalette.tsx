import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarPlus,
  CheckSquare,
  Moon,
  Plus,
  Receipt,
  Search,
  Sun,
  Timer,
  UserPlus,
  X,
} from 'lucide-react'
import { useLedger } from '../context/LedgerContext'

export function CommandPalette() {
  const {
    state,
    commandOpen,
    setCommandOpen,
    shortcutsOpen,
    setShortcutsOpen,
    setActiveNav,
    setDrawer,
    startTimer,
    updateSettings,
  } = useLedger()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (commandOpen) {
      setQuery('')
      window.setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [commandOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(!commandOpen)
        return
      }
      if (e.key === 'Escape') {
        if (commandOpen) setCommandOpen(false)
        if (shortcutsOpen) setShortcutsOpen(false)
        return
      }
      const tag = (e.target as HTMLElement | null)?.tagName
      const isEditing =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        Boolean((e.target as HTMLElement | null)?.isContentEditable)
      if (isEditing || commandOpen || shortcutsOpen) return

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setDrawer({ kind: 'task' })
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setDrawer({ kind: 'lesson' })
      } else if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commandOpen, shortcutsOpen, setCommandOpen, setShortcutsOpen, setDrawer])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const actions = [
      {
        id: 'act-new-task',
        group: 'Create',
        label: 'New Task',
        hint: 'N',
        icon: Plus,
        run: () => setDrawer({ kind: 'task' }),
      },
      {
        id: 'act-new-lesson',
        group: 'Create',
        label: 'Log / Schedule Lesson',
        hint: 'L',
        icon: CalendarPlus,
        run: () => setDrawer({ kind: 'lesson' }),
      },
      {
        id: 'act-new-student',
        group: 'Create',
        label: 'Add Student / Tutoring Gig',
        hint: '',
        icon: UserPlus,
        run: () => setDrawer({ kind: 'student' }),
      },
      {
        id: 'act-new-expense',
        group: 'Create',
        label: 'Log Expense',
        hint: '',
        icon: Receipt,
        run: () => setDrawer({ kind: 'expense' }),
      },
      {
        id: 'act-start-timer',
        group: 'Studio',
        label: 'Start Live Session Timer',
        hint: '',
        icon: Timer,
        run: () => startTimer(),
      },
      {
        id: 'act-theme',
        group: 'Studio',
        label:
          state.settings.theme === 'paper' ? 'Switch to Ink Dark Mode' : 'Switch to Paper Light Mode',
        hint: '',
        icon: state.settings.theme === 'paper' ? Moon : Sun,
        run: () =>
          updateSettings({ theme: state.settings.theme === 'paper' ? 'ink' : 'paper' }),
      },
    ]

    const nav = [
      { id: 'nav-overview', group: 'Navigate', label: 'Overview', hint: '', icon: Search, run: () => setActiveNav('overview') },
      { id: 'nav-tasks', group: 'Navigate', label: 'Tasks & Prep Engine', hint: '', icon: CheckSquare, run: () => setActiveNav('tasks') },
      { id: 'nav-lessons', group: 'Navigate', label: 'Lessons & Calendar', hint: '', icon: CalendarPlus, run: () => setActiveNav('lessons') },
      { id: 'nav-students', group: 'Navigate', label: 'Students & Gigs', hint: '', icon: UserPlus, run: () => setActiveNav('students') },
      { id: 'nav-finances', group: 'Navigate', label: 'Finances & Expenses', hint: '', icon: Receipt, run: () => setActiveNav('finances') },
      { id: 'nav-settings', group: 'Navigate', label: 'Settings & Backups', hint: '', icon: Search, run: () => setActiveNav('settings') },
    ]

    const students = state.students.map((s) => ({
      id: `stu-${s.id}`,
      group: 'Students',
      label: `${s.name} — ${s.subject}`,
      hint: s.billingModel.type,
      icon: UserPlus,
      run: () => setDrawer({ kind: 'student', studentId: s.id }),
    }))

    const tasks = state.tasks.slice(0, 20).map((t) => ({
      id: `tsk-${t.id}`,
      group: 'Tasks',
      label: t.title,
      hint: t.status,
      icon: CheckSquare,
      run: () => setDrawer({ kind: 'task', taskId: t.id }),
    }))

    const all = [...actions, ...nav, ...students, ...tasks]
    if (!q) return all.slice(0, 14)
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.hint.toLowerCase().includes(q),
    ).slice(0, 16)
  }, [query, state.students, state.tasks, state.settings.theme, setDrawer, setActiveNav, startTimer, updateSettings])

  return (
    <>
      {commandOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-start justify-center px-4 pt-20"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <div
            className="fixed inset-0 bg-black/35"
            onClick={() => setCommandOpen(false)}
            aria-hidden="true"
          />
          <div
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              boxShadow: 'var(--shadow-overlay)',
            }}
          >
            <div
              className="flex items-center gap-2.5 border-b px-4 py-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--ink-muted)' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && items.length > 0) {
                    e.preventDefault()
                    items[0].run()
                    setCommandOpen(false)
                  }
                }}
                placeholder="Search students, tasks, or run an action…"
                className="w-full bg-transparent text-[14px] outline-none"
                style={{ color: 'var(--ink-primary)' }}
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                aria-label="Close command palette"
                className="rounded p-1"
                style={{ color: 'var(--ink-muted)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {items.length === 0 ? (
                <div className="px-3 py-6 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                  No matching commands or records.
                </div>
              ) : (
                items.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.run()
                        setCommandOpen(false)
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-black/5"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                        <span className="truncate font-medium">{item.label}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                          {item.group}
                        </span>
                        {item.hint && (
                          <kbd
                            className="font-mono-ledger rounded border px-1.5 py-0.5 text-[10px]"
                            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                          >
                            {item.hint}
                          </kbd>
                        )}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {shortcutsOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div
            className="fixed inset-0 bg-black/35"
            onClick={() => setShortcutsOpen(false)}
            aria-hidden="true"
          />
          <div
            className="relative z-10 w-full max-w-md rounded-xl border p-6"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              boxShadow: 'var(--shadow-overlay)',
            }}
          >
            <div className="flex items-center justify-between pb-3">
              <h2 className="font-display text-xl font-semibold">Keyboard Shortcuts</h2>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                aria-label="Close shortcuts"
                className="rounded p-1"
                style={{ color: 'var(--ink-muted)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y text-[13px]" style={{ borderColor: 'var(--border)' }}>
              {[
                ['⌘ / Ctrl + K', 'Open Command & Search Palette'],
                ['N', 'Create new Task'],
                ['L', 'Log or schedule new Lesson'],
                ['?', 'Show keyboard shortcuts'],
                ['Esc', 'Close active drawer or dialog'],
              ].map(([keys, desc]) => (
                <div key={keys} className="flex items-center justify-between py-2.5" style={{ borderColor: 'var(--border)' }}>
                  <span style={{ color: 'var(--ink-secondary)' }}>{desc}</span>
                  <kbd
                    className="font-mono-ledger rounded border px-2 py-0.5 text-[11px] font-medium"
                    style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-rail)' }}
                  >
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
