import {
  BookOpen,
  CalendarClock,
  CheckSquare,
  Cloud,
  Command,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { useMemo } from 'react'
import { computeFinancialReport } from '../domain/analytics'
import { resolvePeriodRange } from '../domain/dates'
import { useLedger, type NavSection } from '../context/LedgerContext'
import { TimerPill } from './TimerPill'

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
  onOpenMobile: () => void
}

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'lessons', label: 'Lessons & Calendar', icon: CalendarClock },
  { id: 'students', label: 'Students & Gigs', icon: Users },
  { id: 'finances', label: 'Finances & Expenses', icon: Landmark },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ mobileOpen, onCloseMobile, onOpenMobile }: SidebarProps) {
  const {
    state,
    today,
    activeNav,
    setActiveNav,
    setCommandOpen,
    setShortcutsOpen,
    updateSettings,
    syncConfig,
    syncStatus,
  } = useLedger()

  const counts = useMemo(() => {
    const openTasks = state.tasks.filter((t) => t.status !== 'Done').length
    const todayLessons = state.lessons.filter(
      (l) => l.date === today && l.status === 'Scheduled',
    ).length
    const monthRange = resolvePeriodRange('this_month', today)
    const unpaidCount = computeFinancialReport(state, monthRange, today).receivables.length
    return { openTasks, todayLessons, unpaidCount }
  }, [state, today])

  const badgeFor = (id: NavSection): number | null => {
    if (id === 'tasks' && counts.openTasks > 0) return counts.openTasks
    if (id === 'lessons' && counts.todayLessons > 0) return counts.todayLessons
    if (id === 'finances' && counts.unpaidCount > 0) return counts.unpaidCount
    return null
  }

  const railBody = (
    <div className="flex h-full flex-col justify-between p-4">
      <div>
        <div className="flex items-center justify-between gap-2 pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              <BookOpen className="h-4 w-4" strokeWidth={1.7} />
            </span>
            <div>
              <div className="font-display text-[17px] font-semibold leading-tight tracking-tight">
                Atelier Ledger
              </div>
              <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                Studio &amp; Taskbook
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="rounded p-1 lg:hidden"
            style={{ color: 'var(--ink-secondary)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onCloseMobile()
            setCommandOpen(true)
          }}
          className="ledger-control mb-4 flex w-full items-center justify-between px-2.5 py-1.5 text-[12px]"
          style={{ color: 'var(--ink-secondary)' }}
        >
          <span className="flex items-center gap-2">
            <Command className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span>Quick search &amp; actions</span>
          </span>
          <kbd
            className="font-mono-ledger rounded border px-1.5 py-0.5 text-[10px]"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
          >
            ⌘K
          </kbd>
        </button>

        <nav aria-label="Main navigation" className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activeNav === item.id
            const badge = badgeFor(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveNav(item.id)
                  onCloseMobile()
                }}
                aria-current={active ? 'page' : undefined}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                  color: active ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                  border: active ? '1px solid var(--border)' : '1px solid transparent',
                }}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className="h-4 w-4 shrink-0"
                    strokeWidth={1.6}
                    style={{ color: active ? 'var(--accent)' : 'var(--ink-muted)' }}
                  />
                  <span className="whitespace-nowrap">{item.label}</span>
                </span>
                {badge !== null && (
                  <span
                    className="tabular-nums rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none"
                    style={{
                      backgroundColor:
                        item.id === 'finances' ? 'var(--terracotta-tint)' : 'var(--bg-subtle)',
                      color: item.id === 'finances' ? 'var(--terracotta)' : 'var(--ink-secondary)',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-4">
        <TimerPill />

        {syncConfig.gistId.trim() && (
          <button
            type="button"
            onClick={() => {
              setActiveNav('settings')
              onCloseMobile()
            }}
            className="flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[11px]"
            style={{
              borderColor:
                syncStatus.kind === 'conflict' || syncStatus.kind === 'error'
                  ? 'var(--terracotta)'
                  : 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
              color:
                syncStatus.kind === 'conflict' || syncStatus.kind === 'error'
                  ? 'var(--terracotta)'
                  : 'var(--ink-secondary)',
            }}
          >
            <span className="flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5" />
              <span>
                {syncStatus.kind === 'syncing'
                  ? 'Syncing…'
                  : syncStatus.kind === 'conflict'
                    ? 'Sync conflict'
                    : syncStatus.kind === 'error'
                      ? 'Sync error'
                      : 'Gist synced'}
              </span>
            </span>
          </button>
        )}

        <div
          className="flex items-center justify-between gap-2 border-t pt-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={() =>
              updateSettings({ theme: state.settings.theme === 'paper' ? 'ink' : 'paper' })
            }
            className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] transition-colors hover:opacity-80"
            style={{ color: 'var(--ink-secondary)' }}
            aria-label="Toggle color theme"
          >
            {state.settings.theme === 'paper' ? (
              <>
                <Moon className="h-3.5 w-3.5" strokeWidth={1.6} />
                <span>Ink Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5" strokeWidth={1.6} />
                <span>Paper Light</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[12px] transition-colors hover:opacity-80"
            style={{ color: 'var(--ink-muted)' }}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span className="font-mono-ledger text-[11px]">?</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile compact header */}
      <header
        className="no-print sticky top-0 z-20 flex items-center justify-between border-b px-4 py-2.5 lg:hidden"
        style={{ backgroundColor: 'var(--bg-rail)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenMobile}
            aria-label="Open navigation menu"
            className="rounded-md border p-1.5"
            style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}
          >
            <Menu className="h-4 w-4" strokeWidth={1.6} />
          </button>
          <span className="font-display text-lg font-semibold">Atelier Ledger</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="btn-secondary flex items-center gap-1.5 px-2.5 py-1 text-[12px]"
          >
            <Command className="h-3.5 w-3.5" />
            <span>Search</span>
          </button>
        </div>
      </header>

      {/* Desktop persistent left rail */}
      <aside
        className="no-print hidden w-64 shrink-0 border-r lg:sticky lg:top-0 lg:block lg:h-screen"
        style={{ backgroundColor: 'var(--bg-rail)', borderColor: 'var(--border)' }}
      >
        {railBody}
      </aside>

      {/* Mobile slide-over rail */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/30" onClick={onCloseMobile} aria-hidden="true" />
          <aside
            className="relative z-10 h-full w-64 border-r"
            style={{ backgroundColor: 'var(--bg-rail)', borderColor: 'var(--border)' }}
          >
            {railBody}
          </aside>
        </div>
      )}

      <TimerPill compact />
    </>
  )
}
