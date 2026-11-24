import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { todayISO } from '../domain/dates'
import { completeTaskWithRecurrence } from '../domain/recurrence'
import type { ReceivableItem } from '../domain/analytics'
import {
  clearSyncConfig,
  createPrivateGist,
  loadSyncConfig,
  pullFromGist,
  pushToGist,
  saveSyncConfig,
  type SyncConfig,
  type SyncStatus,
} from '../domain/gistSync'
import {
  createDemoLedgerState,
  createEmptyLedgerState,
  loadIndexedDBState,
  loadLedgerState,
  requestPersistentStorage,
  saveIndexedDBState,
  saveLedgerState,
} from '../domain/storage'
import type {
  Expense,
  LedgerState,
  Lesson,
  PackagePurchase,
  PaymentMethod,
  Student,
  Task,
  TaskStatus,
  WorkspaceSettings,
} from '../domain/types'

export type NavSection =
  | 'overview'
  | 'tasks'
  | 'lessons'
  | 'students'
  | 'finances'
  | 'settings'

export type DrawerTarget =
  | { kind: 'task'; taskId?: string; initialStudentId?: string; initialLessonId?: string; initialStatus?: TaskStatus }
  | { kind: 'lesson'; lessonId?: string; initialStudentId?: string; initialDate?: string; initialDurationMin?: number; initialStartTime?: string }
  | { kind: 'student'; studentId?: string }
  | { kind: 'expense'; expenseId?: string }
  | { kind: 'statement'; studentId: string }
  | null

interface LedgerContextValue {
  state: LedgerState
  today: string
  activeNav: NavSection
  setActiveNav: (nav: NavSection) => void
  drawer: DrawerTarget
  setDrawer: (target: DrawerTarget) => void
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void

  // Task actions
  upsertTask: (task: Task) => void
  toggleTaskDone: (taskId: string) => void
  deleteTask: (taskId: string) => void
  batchUpdateTasks: (ids: string[], patch: Partial<Task> | { action: 'complete' | 'delete' }) => void

  // Student actions
  upsertStudent: (student: Student) => void
  deleteStudent: (studentId: string) => void
  addPackagePurchase: (studentId: string, purchase: Omit<PackagePurchase, 'id'>) => void
  markPackagePurchasePaid: (studentId: string, purchaseId: string, method?: PaymentMethod) => void
  setRetainerCycleStatus: (
    studentId: string,
    cycleKey: string,
    status: 'Unpaid' | 'Invoiced' | 'Paid',
    method?: PaymentMethod,
  ) => void

  // Lesson actions
  upsertLesson: (lesson: Lesson) => void
  deleteLesson: (lessonId: string) => void
  markLessonPaid: (lessonId: string, method?: PaymentMethod) => void
  settleReceivable: (item: ReceivableItem, method?: PaymentMethod) => void

  // Expense actions
  upsertExpense: (expense: Expense) => void
  deleteExpense: (expenseId: string) => void
  materializeRecurringExpenses: (pending: Expense[]) => void

  // Timer actions
  startTimer: (studentId?: string, lessonId?: string, topic?: string) => void
  pauseTimer: () => void
  resetTimer: () => void
  finishTimerToLesson: () => void
  setTimerTarget: (studentId?: string, lessonId?: string) => void

  // Settings & portability
  updateSettings: (patch: Partial<WorkspaceSettings>) => void
  clearDemoData: () => void
  reloadDemoData: () => void
  replaceImportedState: (next: LedgerState) => void

  // Cross-device Private GitHub Gist Sync
  syncConfig: SyncConfig
  syncStatus: SyncStatus
  updateSyncConfig: (patch: Partial<SyncConfig>) => void
  syncCreatePrivateGist: (tokenOverride?: string) => Promise<void>
  syncPullNow: (configOverride?: Partial<SyncConfig>) => Promise<void>
  syncPushNow: (force?: boolean) => Promise<void>
  syncDisconnect: () => void
  acceptRemoteConflict: () => void
}

const LedgerContext = createContext<LedgerContextValue | null>(null)

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LedgerState>(() => loadLedgerState())
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => loadSyncConfig())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => ({
    kind: 'idle',
    message: '',
  }))
  const [activeNav, setActiveNav] = useState<NavSection>('overview')
  const [drawer, setDrawer] = useState<DrawerTarget>(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const today = useMemo(() => todayISO(), [])

  const hydratedRef = useRef(false)
  const dirtyForSyncRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const syncConfigRef = useRef(syncConfig)
  syncConfigRef.current = syncConfig

  const commitState = useCallback((updater: (prev: LedgerState) => LedgerState) => {
    dirtyForSyncRef.current = true
    setState((prev) => {
      const next = updater(prev)
      if (next === prev) return prev
      return { ...next, updatedAt: new Date().toISOString() }
    })
  }, [])

  // Hydrate primary state from IndexedDB on boot, migrating any newer localStorage state cleanly.
  useEffect(() => {
    let active = true
    ;(async () => {
      const idbState = await loadIndexedDBState()
      const current = stateRef.current
      if (!active) return

      let chosen = current
      if (idbState) {
        const currentIsUntouchedDemo = current.demoLoaded && !current.updatedAt
        const idbNewer =
          idbState.updatedAt !== undefined &&
          (!current.updatedAt || idbState.updatedAt >= current.updatedAt)
        if (currentIsUntouchedDemo || idbNewer) {
          chosen = idbState
          setState(idbState)
          saveLedgerState(idbState)
        } else {
          await saveIndexedDBState(current)
        }
      } else {
        await saveIndexedDBState(current)
      }

      hydratedRef.current = true
      void requestPersistentStorage()

      const cfg = syncConfigRef.current
      if (cfg.token.trim() && cfg.gistId.trim() && cfg.autoSync) {
        setSyncStatus({ kind: 'syncing', message: 'Checking remote Gist…' })
        try {
          const pulled = await pullFromGist(cfg)
          if (!active) return
          const localUntouchedDemo = chosen.demoLoaded && !chosen.updatedAt
          const remoteStamp = pulled.state.updatedAt ?? pulled.nextConfig.lastRemoteUpdatedAt ?? ''
          const localStamp = chosen.updatedAt ?? ''
          const localUnsynced =
            !chosen.demoLoaded &&
            Boolean(localStamp) &&
            (!cfg.lastSyncedAt || localStamp > cfg.lastSyncedAt)
          const remoteChanged =
            Boolean(remoteStamp) &&
            (!cfg.lastRemoteUpdatedAt || remoteStamp > cfg.lastRemoteUpdatedAt)

          if (localUntouchedDemo || (remoteChanged && !localUnsynced)) {
            dirtyForSyncRef.current = false
            setState(pulled.state)
            saveLedgerState(pulled.state)
            await saveIndexedDBState(pulled.state)
            setSyncConfig(pulled.nextConfig)
            saveSyncConfig(pulled.nextConfig)
            setSyncStatus({ kind: 'synced', message: 'Synced from private Gist' })
          } else if (remoteChanged && localUnsynced) {
            setSyncStatus({
              kind: 'conflict',
              message: 'Both this device and your remote Gist changed since last sync.',
              remoteCandidate: pulled.state,
            })
          } else {
            setSyncConfig(pulled.nextConfig)
            saveSyncConfig(pulled.nextConfig)
            setSyncStatus({ kind: 'synced', message: 'Up to date' })
          }
        } catch (err) {
          if (!active) return
          setSyncStatus({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Sync check failed.',
          })
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Persist to IndexedDB (primary) + localStorage (sync fast cache) whenever state updates post-hydration.
  useEffect(() => {
    if (!hydratedRef.current) return
    saveLedgerState(state)
    void saveIndexedDBState(state)
  }, [state])

  // Debounced auto-push to private GitHub Gist after user edits.
  useEffect(() => {
    if (!hydratedRef.current || !dirtyForSyncRef.current) return
    if (!syncConfig.token.trim() || !syncConfig.gistId.trim() || !syncConfig.autoSync) return
    if (syncStatus.kind === 'conflict') return

    const timerId = window.setTimeout(async () => {
      if (!dirtyForSyncRef.current) return
      setSyncStatus({ kind: 'syncing', message: 'Syncing to private Gist…' })
      try {
        const outcome = await pushToGist(stateRef.current, syncConfigRef.current)
        if (outcome.kind === 'pushed') {
          dirtyForSyncRef.current = false
          setSyncConfig(outcome.nextConfig)
          saveSyncConfig(outcome.nextConfig)
          setSyncStatus({ kind: 'synced', message: 'Synced to private Gist' })
        } else {
          setSyncStatus({
            kind: 'conflict',
            message: outcome.reason,
            remoteCandidate: outcome.remoteState,
          })
        }
      } catch (err) {
        setSyncStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Auto-sync push failed.',
        })
      }
    }, 1800)

    return () => window.clearTimeout(timerId)
  }, [state, syncConfig, syncStatus.kind])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme)
  }, [state.settings.theme])

  const upsertTask = useCallback(
    (task: Task) => {
      commitState((prev) => {
        const exists = prev.tasks.some((t) => t.id === task.id)
        return {
          ...prev,
          tasks: exists
            ? prev.tasks.map((t) => (t.id === task.id ? task : t))
            : [task, ...prev.tasks],
        }
      })
    },
    [commitState],
  )

  const toggleTaskDone = useCallback(
    (taskId: string) => {
      commitState((prev) => {
        const target = prev.tasks.find((t) => t.id === taskId)
        if (!target) return prev
        if (target.status === 'Done') {
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId ? { ...t, status: 'To Do', completedAt: undefined } : t,
            ),
          }
        }
        const { tasks } = completeTaskWithRecurrence(
          prev.tasks,
          taskId,
          () => createId('tsk'),
          today,
        )
        return { ...prev, tasks }
      })
    },
    [commitState, today],
  )

  const deleteTask = useCallback(
    (taskId: string) => {
      commitState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      }))
    },
    [commitState],
  )

  const batchUpdateTasks = useCallback(
    (ids: string[], patch: Partial<Task> | { action: 'complete' | 'delete' }) => {
      const idSet = new Set(ids)
      commitState((prev) => {
        if ('action' in patch && patch.action === 'delete') {
          return { ...prev, tasks: prev.tasks.filter((t) => !idSet.has(t.id)) }
        }
        if ('action' in patch && patch.action === 'complete') {
          let nextTasks = prev.tasks
          for (const id of ids) {
            nextTasks = completeTaskWithRecurrence(
              nextTasks,
              id,
              () => createId('tsk'),
              today,
            ).tasks
          }
          return { ...prev, tasks: nextTasks }
        }
        const fields = patch as Partial<Task>
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (idSet.has(t.id) ? { ...t, ...fields } : t)),
        }
      })
    },
    [commitState, today],
  )

  const upsertStudent = useCallback(
    (student: Student) => {
      commitState((prev) => {
        const exists = prev.students.some((s) => s.id === student.id)
        return {
          ...prev,
          students: exists
            ? prev.students.map((s) => (s.id === student.id ? student : s))
            : [...prev.students, student],
        }
      })
    },
    [commitState],
  )

  const deleteStudent = useCallback(
    (studentId: string) => {
      commitState((prev) => ({
        ...prev,
        students: prev.students.filter((s) => s.id !== studentId),
        lessons: prev.lessons.filter((l) => l.studentId !== studentId),
        retainerPayments: prev.retainerPayments.filter((r) => r.studentId !== studentId),
        tasks: prev.tasks.map((t) =>
          t.studentId === studentId ? { ...t, studentId: undefined, lessonId: undefined } : t,
        ),
        expenses: prev.expenses.map((e) =>
          e.studentId === studentId ? { ...e, studentId: undefined } : e,
        ),
      }))
    },
    [commitState],
  )

  const addPackagePurchase = useCallback(
    (studentId: string, purchase: Omit<PackagePurchase, 'id'>) => {
      commitState((prev) => ({
        ...prev,
        students: prev.students.map((s) => {
          if (s.id !== studentId || s.billingModel.type !== 'package') return s
          return {
            ...s,
            billingModel: {
              ...s.billingModel,
              purchases: [...s.billingModel.purchases, { ...purchase, id: createId('pkg') }],
            },
          }
        }),
      }))
    },
    [commitState],
  )

  const markPackagePurchasePaid = useCallback(
    (studentId: string, purchaseId: string, method: PaymentMethod = 'Bank Transfer') => {
      commitState((prev) => ({
        ...prev,
        students: prev.students.map((s) => {
          if (s.id !== studentId || s.billingModel.type !== 'package') return s
          return {
            ...s,
            billingModel: {
              ...s.billingModel,
              purchases: s.billingModel.purchases.map((p) =>
                p.id === purchaseId
                  ? { ...p, paymentStatus: 'Paid', paidDate: today, paymentMethod: method }
                  : p,
              ),
            },
          }
        }),
      }))
    },
    [commitState, today],
  )

  const setRetainerCycleStatus = useCallback(
    (
      studentId: string,
      cycleKey: string,
      status: 'Unpaid' | 'Invoiced' | 'Paid',
      method: PaymentMethod = 'Bank Transfer',
    ) => {
      commitState((prev) => {
        const idx = prev.retainerPayments.findIndex(
          (r) => r.studentId === studentId && r.cycleKey === cycleKey,
        )
        const record = {
          id: idx >= 0 ? prev.retainerPayments[idx].id : createId('ret'),
          studentId,
          cycleKey,
          paymentStatus: status,
          paidDate: status === 'Paid' ? today : undefined,
          paymentMethod: status === 'Paid' ? method : undefined,
        }
        const next =
          idx >= 0
            ? prev.retainerPayments.map((r, i) => (i === idx ? record : r))
            : [...prev.retainerPayments, record]
        return { ...prev, retainerPayments: next }
      })
    },
    [commitState, today],
  )

  const upsertLesson = useCallback(
    (lesson: Lesson) => {
      commitState((prev) => {
        const exists = prev.lessons.some((l) => l.id === lesson.id)
        return {
          ...prev,
          lessons: exists
            ? prev.lessons.map((l) => (l.id === lesson.id ? lesson : l))
            : [lesson, ...prev.lessons],
        }
      })
    },
    [commitState],
  )

  const deleteLesson = useCallback(
    (lessonId: string) => {
      commitState((prev) => ({
        ...prev,
        lessons: prev.lessons.filter((l) => l.id !== lessonId),
        tasks: prev.tasks.map((t) => (t.lessonId === lessonId ? { ...t, lessonId: undefined } : t)),
      }))
    },
    [commitState],
  )

  const markLessonPaid = useCallback(
    (lessonId: string, method: PaymentMethod = 'Bank Transfer') => {
      commitState((prev) => ({
        ...prev,
        lessons: prev.lessons.map((l) =>
          l.id === lessonId
            ? { ...l, paymentStatus: 'Paid', paidDate: today, paymentMethod: method }
            : l,
        ),
      }))
    },
    [commitState, today],
  )

  const settleReceivable = useCallback(
    (item: ReceivableItem, method: PaymentMethod = 'Bank Transfer') => {
      if (item.kind === 'lesson') {
        markLessonPaid(item.id, method)
      } else if (item.kind === 'retainer_cycle' && item.cycleKey) {
        setRetainerCycleStatus(item.studentId, item.cycleKey, 'Paid', method)
      } else if (item.kind === 'package_purchase' && item.purchaseId) {
        markPackagePurchasePaid(item.studentId, item.purchaseId, method)
      }
    },
    [markLessonPaid, setRetainerCycleStatus, markPackagePurchasePaid],
  )

  const upsertExpense = useCallback(
    (expense: Expense) => {
      commitState((prev) => {
        const exists = prev.expenses.some((e) => e.id === expense.id)
        return {
          ...prev,
          expenses: exists
            ? prev.expenses.map((e) => (e.id === expense.id ? expense : e))
            : [expense, ...prev.expenses],
        }
      })
    },
    [commitState],
  )

  const deleteExpense = useCallback(
    (expenseId: string) => {
      commitState((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== expenseId),
      }))
    },
    [commitState],
  )

  const materializeRecurringExpenses = useCallback(
    (pending: Expense[]) => {
      if (pending.length === 0) return
      commitState((prev) => ({
        ...prev,
        expenses: [
          ...pending.map((p) => ({
            ...p,
            id: createId('exp'),
            date: today,
          })),
          ...prev.expenses,
        ],
      }))
    },
    [commitState, today],
  )

  const startTimer = useCallback((studentId?: string, lessonId?: string, topic?: string) => {
    const now = Date.now()
    setState((prev) => ({
      ...prev,
      timer: {
        running: true,
        startedAtMs: now,
        accumulatedMs: prev.timer.running
          ? prev.timer.accumulatedMs + (now - (prev.timer.startedAtMs ?? now))
          : prev.timer.accumulatedMs,
        studentId: studentId ?? prev.timer.studentId,
        lessonId: lessonId ?? prev.timer.lessonId,
        topic: topic ?? prev.timer.topic,
      },
    }))
  }, [])

  const pauseTimer = useCallback(() => {
    const now = Date.now()
    setState((prev) => {
      if (!prev.timer.running) return prev
      return {
        ...prev,
        timer: {
          ...prev.timer,
          running: false,
          startedAtMs: null,
          accumulatedMs: prev.timer.accumulatedMs + (now - (prev.timer.startedAtMs ?? now)),
        },
      }
    })
  }, [])

  const resetTimer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      timer: { running: false, startedAtMs: null, accumulatedMs: 0 },
    }))
  }, [])

  const setTimerTarget = useCallback((studentId?: string, lessonId?: string) => {
    setState((prev) => ({
      ...prev,
      timer: { ...prev.timer, studentId, lessonId },
    }))
  }, [])

  const finishTimerToLesson = useCallback(() => {
    const now = Date.now()
    const totalMs =
      state.timer.accumulatedMs +
      (state.timer.running && state.timer.startedAtMs ? now - state.timer.startedAtMs : 0)
    const elapsedMin = Math.max(1, Math.round(totalMs / 60_000))
    const startClock = new Date(now - totalMs)
    const startTime = `${String(startClock.getHours()).padStart(2, '0')}:${String(
      startClock.getMinutes(),
    ).padStart(2, '0')}`
    const targetLessonId = state.timer.lessonId
    const targetStudentId = state.timer.studentId

    setState((prev) => ({
      ...prev,
      timer: { running: false, startedAtMs: null, accumulatedMs: 0 },
    }))

    if (targetLessonId) {
      setDrawer({
        kind: 'lesson',
        lessonId: targetLessonId,
        initialDurationMin: elapsedMin,
      })
    } else {
      setDrawer({
        kind: 'lesson',
        initialStudentId: targetStudentId,
        initialDate: today,
        initialStartTime: startTime,
        initialDurationMin: elapsedMin,
      })
    }
  }, [state.timer, today])

  const updateSettings = useCallback(
    (patch: Partial<WorkspaceSettings>) => {
      commitState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }))
    },
    [commitState],
  )

  const clearDemoData = useCallback(() => {
    commitState((prev) => createEmptyLedgerState(prev.settings))
    setDrawer(null)
  }, [commitState])

  const reloadDemoData = useCallback(() => {
    commitState((prev) => {
      const demo = createDemoLedgerState(today)
      return { ...demo, settings: { ...demo.settings, theme: prev.settings.theme } }
    })
    setDrawer(null)
  }, [commitState, today])

  const replaceImportedState = useCallback(
    (next: LedgerState) => {
      commitState(() => next)
      setDrawer(null)
    },
    [commitState],
  )

  const updateSyncConfig = useCallback((patch: Partial<SyncConfig>) => {
    setSyncConfig((prev) => {
      const next = { ...prev, ...patch }
      saveSyncConfig(next)
      return next
    })
  }, [])

  const syncCreatePrivateGist = useCallback(async (tokenOverride?: string) => {
    const cfg = {
      ...syncConfigRef.current,
      token: tokenOverride ?? syncConfigRef.current.token,
    }
    setSyncStatus({ kind: 'syncing', message: 'Creating private Gist…' })
    try {
      const stamped: LedgerState = {
        ...stateRef.current,
        updatedAt: stateRef.current.updatedAt ?? new Date().toISOString(),
      }
      const created = await createPrivateGist(stamped, cfg.token, cfg.filename)
      const nextConfig: SyncConfig = {
        ...cfg,
        gistId: created.gistId,
        lastSyncedAt: created.updatedAt,
        lastRemoteUpdatedAt: created.updatedAt,
      }
      dirtyForSyncRef.current = false
      setState(stamped)
      setSyncConfig(nextConfig)
      saveSyncConfig(nextConfig)
      setSyncStatus({ kind: 'synced', message: `Private Gist created (${created.gistId})` })
    } catch (err) {
      setSyncStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to create private Gist.',
      })
    }
  }, [])

  const syncPullNow = useCallback(async (configOverride?: Partial<SyncConfig>) => {
    const cfg = { ...syncConfigRef.current, ...configOverride }
    setSyncStatus({ kind: 'syncing', message: 'Pulling from private Gist…' })
    try {
      const { state: remoteState, nextConfig } = await pullFromGist(cfg)
      dirtyForSyncRef.current = false
      setState(remoteState)
      saveLedgerState(remoteState)
      void saveIndexedDBState(remoteState)
      setSyncConfig(nextConfig)
      saveSyncConfig(nextConfig)
      setSyncStatus({ kind: 'synced', message: 'Pulled latest workspace from Gist.' })
    } catch (err) {
      setSyncStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Gist pull failed.',
      })
    }
  }, [])

  const syncPushNow = useCallback(async (force = false) => {
    const cfg = syncConfigRef.current
    setSyncStatus({ kind: 'syncing', message: 'Pushing workspace to Gist…' })
    try {
      const outcome = await pushToGist(stateRef.current, cfg, { force })
      if (outcome.kind === 'pushed') {
        dirtyForSyncRef.current = false
        setState((prev) => ({ ...prev, updatedAt: outcome.stamp }))
        setSyncConfig(outcome.nextConfig)
        saveSyncConfig(outcome.nextConfig)
        setSyncStatus({ kind: 'synced', message: 'Pushed latest workspace to Gist.' })
      } else {
        setSyncStatus({
          kind: 'conflict',
          message: outcome.reason,
          remoteCandidate: outcome.remoteState,
        })
      }
    } catch (err) {
      setSyncStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Gist push failed.',
      })
    }
  }, [])

  const acceptRemoteConflict = useCallback(() => {
    const remote = syncStatus.remoteCandidate
    if (!remote) return
    dirtyForSyncRef.current = false
    const now = new Date().toISOString()
    const nextCfg: SyncConfig = {
      ...syncConfigRef.current,
      lastSyncedAt: now,
      lastRemoteUpdatedAt: remote.updatedAt ?? now,
    }
    setState(remote)
    saveLedgerState(remote)
    void saveIndexedDBState(remote)
    setSyncConfig(nextCfg)
    saveSyncConfig(nextCfg)
    setSyncStatus({ kind: 'synced', message: 'Applied remote Gist data.' })
  }, [syncStatus.remoteCandidate])

  const syncDisconnect = useCallback(() => {
    const empty = clearSyncConfig()
    setSyncConfig(empty)
    setSyncStatus({ kind: 'idle', message: '' })
  }, [])

  const value = useMemo<LedgerContextValue>(
    () => ({
      state,
      today,
      activeNav,
      setActiveNav,
      drawer,
      setDrawer,
      commandOpen,
      setCommandOpen,
      shortcutsOpen,
      setShortcutsOpen,
      upsertTask,
      toggleTaskDone,
      deleteTask,
      batchUpdateTasks,
      upsertStudent,
      deleteStudent,
      addPackagePurchase,
      markPackagePurchasePaid,
      setRetainerCycleStatus,
      upsertLesson,
      deleteLesson,
      markLessonPaid,
      settleReceivable,
      upsertExpense,
      deleteExpense,
      materializeRecurringExpenses,
      startTimer,
      pauseTimer,
      resetTimer,
      finishTimerToLesson,
      setTimerTarget,
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
    }),
    [
      state,
      today,
      activeNav,
      drawer,
      commandOpen,
      shortcutsOpen,
      upsertTask,
      toggleTaskDone,
      deleteTask,
      batchUpdateTasks,
      upsertStudent,
      deleteStudent,
      addPackagePurchase,
      markPackagePurchasePaid,
      setRetainerCycleStatus,
      upsertLesson,
      deleteLesson,
      markLessonPaid,
      settleReceivable,
      upsertExpense,
      deleteExpense,
      materializeRecurringExpenses,
      startTimer,
      pauseTimer,
      resetTimer,
      finishTimerToLesson,
      setTimerTarget,
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
    ],
  )

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext)
  if (!ctx) throw new Error('useLedger must be used inside LedgerProvider')
  return ctx
}
