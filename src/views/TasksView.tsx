import { useMemo, useState } from 'react'
import {
  Calendar,
  Columns3,
  List,
  Plus,
  Repeat,
  Search,
  Trash2,
} from 'lucide-react'
import { PriorityBadge, TaskStatusBadge } from '../components/Badges'
import { createId, useLedger } from '../context/LedgerContext'
import { addDaysISO } from '../domain/dates'
import type { Task, TaskPriority, TaskStatus } from '../domain/types'

type SmartView = 'today' | 'inbox' | 'upcoming' | 'all' | 'completed'
type LayoutMode = 'list' | 'board'
type SortKey = 'dueDate' | 'priority' | 'created'

const PRIORITY_RANK: Record<TaskPriority, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
}

const BOARD_COLUMNS: TaskStatus[] = ['Inbox', 'To Do', 'In Progress', 'Waiting', 'Done']

export function TasksView() {
  const { state, today, setDrawer, upsertTask, toggleTaskDone, batchUpdateTasks } = useLedger()
  const [smartView, setSmartView] = useState<SmartView>('today')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('list')
  const [quickTitle, setQuickTitle] = useState('')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [studentFilter, setStudentFilter] = useState('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('dueDate')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const studentMap = useMemo(() => new Map(state.students.map((s) => [s.id, s])), [state.students])
  const lessonMap = useMemo(() => new Map(state.lessons.map((l) => [l.id, l])), [state.lessons])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of state.tasks) {
      for (const tag of t.tags) set.add(tag)
    }
    return Array.from(set).sort()
  }, [state.tasks])

  const smartCounts = useMemo(() => {
    const horizon = addDaysISO(today, 7)
    return {
      today: state.tasks.filter(
        (t) => t.status !== 'Done' && t.dueDate !== undefined && t.dueDate <= today,
      ).length,
      inbox: state.tasks.filter((t) => t.status === 'Inbox').length,
      upcoming: state.tasks.filter(
        (t) =>
          t.status !== 'Done' &&
          t.dueDate !== undefined &&
          t.dueDate >= today &&
          t.dueDate <= horizon,
      ).length,
      all: state.tasks.filter((t) => t.status !== 'Done').length,
      completed: state.tasks.filter((t) => t.status === 'Done').length,
    }
  }, [state.tasks, today])

  const filteredTasks = useMemo(() => {
    const horizon = addDaysISO(today, 7)
    const q = search.trim().toLowerCase()

    return state.tasks
      .filter((t) => {
        if (layoutMode === 'list') {
          if (smartView === 'today') {
            if (t.status === 'Done' || !t.dueDate || t.dueDate > today) return false
          } else if (smartView === 'inbox') {
            if (t.status !== 'Inbox') return false
          } else if (smartView === 'upcoming') {
            if (t.status === 'Done' || !t.dueDate || t.dueDate < today || t.dueDate > horizon)
              return false
          } else if (smartView === 'completed') {
            if (t.status !== 'Done') return false
          } else if (smartView === 'all') {
            if (t.status === 'Done') return false
          }
        }
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
        if (tagFilter !== 'all' && !t.tags.includes(tagFilter)) return false
        if (studentFilter !== 'all' && t.studentId !== studentFilter) return false
        if (overdueOnly && (!t.dueDate || t.dueDate >= today || t.status === 'Done')) return false
        if (q) {
          const hay = `${t.title} ${t.notes} ${t.tags.join(' ')}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .slice()
      .sort((a, b) => {
        if (sortBy === 'priority') {
          return (
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
          )
        }
        if (sortBy === 'created') {
          return b.createdAt.localeCompare(a.createdAt)
        }
        return (
          (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        )
      })
  }, [
    state.tasks,
    layoutMode,
    smartView,
    today,
    priorityFilter,
    tagFilter,
    studentFilter,
    overdueOnly,
    search,
    sortBy,
  ])

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickTitle.trim()) return
    const status: TaskStatus = smartView === 'inbox' ? 'Inbox' : 'To Do'
    const dueDate = smartView === 'inbox' ? undefined : today
    const newTask: Task = {
      id: createId('tsk'),
      title: quickTitle.trim(),
      notes: '',
      status,
      priority: 'Medium',
      tags: [],
      dueDate,
      subtasks: [],
      recurrence: { frequency: 'None' },
      studentId: studentFilter !== 'all' ? studentFilter : undefined,
      createdAt: today,
    }
    upsertTask(newTask)
    setQuickTitle('')
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Tasks &amp; Prep Engine</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
            Manage lesson prep, recurring studio routines, subtasks, and personal tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-lg border p-0.5"
            style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-rail)' }}
          >
            <button
              type="button"
              onClick={() => setLayoutMode('list')}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium"
              style={{
                backgroundColor: layoutMode === 'list' ? 'var(--bg-surface)' : 'transparent',
                color: layoutMode === 'list' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
              }}
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('board')}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium"
              style={{
                backgroundColor: layoutMode === 'board' ? 'var(--bg-surface)' : 'transparent',
                color: layoutMode === 'board' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
              }}
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span>Board</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDrawer({ kind: 'task', initialStatus: smartView === 'inbox' ? 'Inbox' : 'To Do' })}
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Smart View Tabs */}
      {layoutMode === 'list' && (
        <div className="flex flex-wrap gap-1.5 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          {(
            [
              ['today', 'Today & Overdue', smartCounts.today],
              ['inbox', 'Inbox', smartCounts.inbox],
              ['upcoming', 'Upcoming (7d)', smartCounts.upcoming],
              ['all', 'All Open', smartCounts.all],
              ['completed', 'Completed Archive', smartCounts.completed],
            ] as const
          ).map(([id, label, count]) => {
            const active = smartView === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSmartView(id)
                  setSelectedIds([])
                }}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium"
                style={{
                  backgroundColor: active ? 'var(--accent)' : 'var(--bg-surface)',
                  color: active ? 'var(--accent-ink)' : 'var(--ink-secondary)',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                }}
              >
                <span>{label}</span>
                <span className="tabular-nums text-[11px] opacity-80">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Quick-Add & Multi-Filter Strip */}
      <div className="ledger-sheet space-y-3 p-4">
        <form onSubmit={handleQuickAdd} className="flex gap-2">
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Quick-add task title and press Enter…"
            className="ledger-control flex-1 px-3 py-2 text-[13px]"
          />
          <button type="submit" className="btn-primary px-4 py-2 text-[13px]">
            Add
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <div className="relative flex-1 min-w-44">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5"
              style={{ color: 'var(--ink-muted)' }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tasks…"
              className="ledger-control w-full py-1.5 pr-3 pl-8 text-[12px]"
            />
          </div>

          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
            className="ledger-control px-2.5 py-1.5 text-[12px]"
          >
            <option value="all">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            aria-label="Filter by tag"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="ledger-control px-2.5 py-1.5 text-[12px]"
          >
            <option value="all">All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by student"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            className="ledger-control px-2.5 py-1.5 text-[12px]"
          >
            <option value="all">All Students</option>
            {state.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5" style={{ borderColor: 'var(--border)' }}>
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            <span>Overdue only</span>
          </label>

          <select
            aria-label="Sort tasks"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="ledger-control px-2.5 py-1.5 text-[12px]"
          >
            <option value="dueDate">Sort: Due Date</option>
            <option value="priority">Sort: Priority</option>
            <option value="created">Sort: Newest</option>
          </select>
        </div>

        {/* Batch Actions */}
        {selectedIds.length > 0 && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12px]"
            style={{ backgroundColor: 'var(--accent-tint)', borderColor: 'var(--accent)' }}
          >
            <span className="tabular-nums font-semibold" style={{ color: 'var(--accent)' }}>
              {selectedIds.length} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  batchUpdateTasks(selectedIds, { action: 'complete' })
                  setSelectedIds([])
                }}
                className="btn-primary px-2.5 py-1 text-[11px]"
              >
                Complete
              </button>
              <button
                type="button"
                onClick={() => {
                  batchUpdateTasks(selectedIds, { dueDate: today })
                  setSelectedIds([])
                }}
                className="btn-secondary px-2.5 py-1 text-[11px]"
              >
                Schedule Today
              </button>
              <button
                type="button"
                onClick={() => {
                  batchUpdateTasks(selectedIds, { dueDate: addDaysISO(today, 1) })
                  setSelectedIds([])
                }}
                className="btn-secondary px-2.5 py-1 text-[11px]"
              >
                Move Tomorrow
              </button>
              <button
                type="button"
                onClick={() => {
                  batchUpdateTasks(selectedIds, { action: 'delete' })
                  setSelectedIds([])
                }}
                className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
                style={{ color: 'var(--crimson)' }}
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-[11px] underline"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List or Kanban Board */}
      {layoutMode === 'list' ? (
        <div className="ledger-sheet overflow-hidden">
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                No tasks match this view or filter.
              </p>
              <button
                type="button"
                onClick={() => setDrawer({ kind: 'task' })}
                className="btn-secondary mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Task</span>
              </button>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              <div
                className="flex items-center justify-between px-4 py-2 text-[11px] font-semibold"
                style={{ backgroundColor: 'var(--bg-rail)', color: 'var(--ink-muted)' }}
              >
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      filteredTasks.length > 0 &&
                      filteredTasks.every((t) => selectedIds.includes(t.id))
                    }
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? filteredTasks.map((t) => t.id) : [])
                    }
                  />
                  <span>Select all ({filteredTasks.length})</span>
                </label>
                <span>Due &amp; Status</span>
              </div>

              {filteredTasks.map((task) => {
                const student = task.studentId ? studentMap.get(task.studentId) : undefined
                const lesson = task.lessonId ? lessonMap.get(task.lessonId) : undefined
                const isOverdue = Boolean(
                  task.dueDate && task.dueDate < today && task.status !== 'Done',
                )
                const doneSub = task.subtasks.filter((s) => s.done).length
                return (
                  <div
                    key={task.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-black/2"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${task.title}`}
                        checked={selectedIds.includes(task.id)}
                        onChange={() => toggleSelect(task.id)}
                        className="mt-1 cursor-pointer opacity-60 hover:opacity-100"
                        title="Batch select"
                      />
                      <button
                        type="button"
                        onClick={() => toggleTaskDone(task.id)}
                        aria-label={task.status === 'Done' ? 'Reopen task' : 'Complete task'}
                        className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border text-[11px]"
                        style={{
                          borderColor:
                            task.status === 'Done' ? 'var(--sage)' : 'var(--border-strong)',
                          backgroundColor:
                            task.status === 'Done' ? 'var(--sage)' : 'var(--bg-surface)',
                          color: '#ffffff',
                        }}
                      >
                        {task.status === 'Done' ? '✓' : ''}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDrawer({ kind: 'task', taskId: task.id })}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[14px] font-medium ${
                              task.status === 'Done' ? 'line-through opacity-60' : ''
                            }`}
                          >
                            {task.title}
                          </span>
                          <PriorityBadge priority={task.priority} />
                          {task.recurrence.frequency !== 'None' && (
                            <span
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]"
                              style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--ink-secondary)' }}
                            >
                              <Repeat className="h-3 w-3" />
                              {task.recurrence.frequency}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                          {student && (
                            <span
                              className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                              style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent)' }}
                            >
                              {student.name}
                              {lesson ? ` · ${lesson.topic || lesson.date}` : ''}
                            </span>
                          )}
                          {task.tags.map((tag) => (
                            <span key={tag} className="text-[11px]">
                              #{tag}
                            </span>
                          ))}
                          {task.estimatedMin && (
                            <span className="tabular-nums text-[11px]">~{task.estimatedMin}m</span>
                          )}
                          {task.subtasks.length > 0 && (
                            <span className="tabular-nums inline-flex items-center gap-1.5 text-[11px]">
                              <span>
                                {doneSub}/{task.subtasks.length}
                              </span>
                              <span
                                className="inline-block h-1.5 w-14 overflow-hidden rounded-full"
                                style={{ backgroundColor: 'var(--bg-subtle)' }}
                              >
                                <span
                                  className="block h-full rounded-full"
                                  style={{
                                    width: `${Math.round((doneSub / task.subtasks.length) * 100)}%`,
                                    backgroundColor: 'var(--accent)',
                                  }}
                                />
                              </span>
                            </span>
                          )}
                        </div>
                      </button>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {task.dueDate && (
                        <span
                          className="tabular-nums inline-flex items-center gap-1 text-[12px]"
                          style={{ color: isOverdue ? 'var(--crimson)' : 'var(--ink-secondary)' }}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          {task.dueDate}
                          {task.dueTime ? ` ${task.dueTime}` : ''}
                        </span>
                      )}
                      <TaskStatusBadge status={task.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Status Kanban Board */
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {BOARD_COLUMNS.map((colStatus) => {
            const colTasks = filteredTasks.filter((t) => t.status === colStatus)
            return (
              <section
                key={colStatus}
                className="flex flex-col rounded-lg border p-3"
                style={{ backgroundColor: 'var(--bg-rail)', borderColor: 'var(--border)' }}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <TaskStatusBadge status={colStatus} />
                  <span className="tabular-nums text-[12px] font-semibold" style={{ color: 'var(--ink-muted)' }}>
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => {
                    const stName = task.studentId ? studentMap.get(task.studentId)?.name : undefined
                    return (
                      <div
                        key={task.id}
                        className="rounded-md border p-2.5"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                      >
                        <button
                          type="button"
                          onClick={() => setDrawer({ kind: 'task', taskId: task.id })}
                          className="w-full text-left text-[13px] font-medium hover:underline"
                        >
                          {task.title}
                        </button>
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
                          <PriorityBadge priority={task.priority} />
                          {task.dueDate && (
                            <span className="tabular-nums text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                              {task.dueDate}
                            </span>
                          )}
                        </div>
                        {stName && (
                          <div className="mt-1 truncate text-[11px]" style={{ color: 'var(--accent)' }}>
                            {stName}
                          </div>
                        )}
                        <div className="mt-2">
                          <select
                            aria-label={`Move ${task.title} status`}
                            value={task.status}
                            onChange={(e) => {
                              const next = e.target.value as TaskStatus
                              if (next === 'Done' && task.status !== 'Done') {
                                toggleTaskDone(task.id)
                              } else {
                                upsertTask({
                                  ...task,
                                  status: next,
                                  completedAt: next === 'Done' ? today : undefined,
                                })
                              }
                            }}
                            className="ledger-control w-full px-2 py-1 text-[11px]"
                          >
                            {BOARD_COLUMNS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
