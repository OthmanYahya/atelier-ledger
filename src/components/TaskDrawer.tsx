import { useEffect, useState } from 'react'
import { Plus, Repeat, Trash2 } from 'lucide-react'
import { useLedger, createId } from '../context/LedgerContext'
import { spawnNextRecurringTask } from '../domain/recurrence'
import type {
  RecurrenceFrequency,
  Subtask,
  Task,
  TaskPriority,
  TaskStatus,
} from '../domain/types'
import { Drawer } from './Drawer'
import { MarkdownText } from './MarkdownText'

const STATUSES: TaskStatus[] = ['Inbox', 'To Do', 'In Progress', 'Waiting', 'Done']
const PRIORITIES: TaskPriority[] = ['Urgent', 'High', 'Medium', 'Low']
const FREQUENCIES: RecurrenceFrequency[] = ['None', 'Daily', 'Weekly', 'Biweekly', 'Monthly']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function TaskDrawer() {
  const { state, today, drawer, setDrawer, upsertTask, deleteTask } = useLedger()
  const isOpen = drawer?.kind === 'task'
  const existing = isOpen && drawer.taskId ? state.tasks.find((t) => t.id === drawer.taskId) : undefined

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [previewNotes, setPreviewNotes] = useState(false)
  const [status, setStatus] = useState<TaskStatus>('To Do')
  const [priority, setPriority] = useState<TaskPriority>('Medium')
  const [tagsText, setTagsText] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [estimatedMin, setEstimatedMin] = useState('')
  const [actualMin, setActualMin] = useState('')
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [newSubtask, setNewSubtask] = useState('')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('None')
  const [weekDays, setWeekDays] = useState<number[]>([])
  const [studentId, setStudentId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setPreviewNotes(false)
    setNewSubtask('')
    if (existing) {
      setTitle(existing.title)
      setNotes(existing.notes)
      setStatus(existing.status)
      setPriority(existing.priority)
      setTagsText(existing.tags.join(', '))
      setDueDate(existing.dueDate ?? '')
      setDueTime(existing.dueTime ?? '')
      setEstimatedMin(existing.estimatedMin !== undefined ? String(existing.estimatedMin) : '')
      setActualMin(existing.actualDurationMin !== undefined ? String(existing.actualDurationMin) : '')
      setSubtasks(existing.subtasks)
      setFrequency(existing.recurrence.frequency)
      setWeekDays(existing.recurrence.weekDays ?? [])
      setStudentId(existing.studentId ?? '')
      setLessonId(existing.lessonId ?? '')
    } else {
      setTitle('')
      setNotes('')
      setStatus(drawer.initialStatus ?? 'To Do')
      setPriority('Medium')
      setTagsText('')
      setDueDate(drawer.initialStatus === 'Inbox' ? '' : today)
      setDueTime('')
      setEstimatedMin('')
      setActualMin('')
      setSubtasks([])
      setFrequency('None')
      setWeekDays([])
      setStudentId(drawer.initialStudentId ?? '')
      setLessonId(drawer.initialLessonId ?? '')
    }
  }, [isOpen, existing, drawer, today])

  const filteredLessons = state.lessons
    .filter((l) => !studentId || l.studentId === studentId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))

  const studentMap = new Map(state.students.map((s) => [s.id, s.name]))

  const handleAddSubtask = () => {
    const trimmed = newSubtask.trim()
    if (!trimmed) return
    setSubtasks((prev) => [...prev, { id: createId('sub'), title: trimmed, done: false }])
    setNewSubtask('')
  }

  const toggleWeekDay = (day: number) => {
    setWeekDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    )
  }

  const handleSave = () => {
    if (!title.trim()) {
      setError('Task title is required.')
      return
    }
    const tags = tagsText
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const est = estimatedMin ? Number.parseInt(estimatedMin, 10) : undefined
    const act = actualMin ? Number.parseInt(actualMin, 10) : undefined

    const task: Task = {
      id: existing?.id ?? createId('tsk'),
      title: title.trim(),
      notes,
      status,
      priority,
      tags: Array.from(new Set(tags)),
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      estimatedMin: Number.isFinite(est) && (est ?? 0) >= 0 ? est : undefined,
      actualDurationMin: Number.isFinite(act) && (act ?? 0) >= 0 ? act : undefined,
      subtasks,
      recurrence: {
        frequency,
        weekDays: frequency === 'Weekly' || frequency === 'Biweekly' ? weekDays : undefined,
      },
      studentId: studentId || undefined,
      lessonId: lessonId || undefined,
      createdAt: existing?.createdAt ?? today,
      completedAt:
        status === 'Done' ? existing?.completedAt ?? today : undefined,
    }

    upsertTask(task)
    if (existing && existing.status !== 'Done' && status === 'Done' && task.recurrence.frequency !== 'None') {
      const next = spawnNextRecurringTask(task, createId('tsk'), today)
      if (next) upsertTask(next)
    }
    setDrawer(null)
  }

  const completedSub = subtasks.filter((s) => s.done).length

  return (
    <Drawer
      open={isOpen}
      title={existing ? 'Edit Task' : 'New Task'}
      subtitle={existing ? `Created ${existing.createdAt}` : 'Prep, studio admin, or personal action'}
      onClose={() => setDrawer(null)}
      footer={
        <>
          <div>
            {existing && (
              <button
                type="button"
                onClick={() => {
                  deleteTask(existing.id)
                  setDrawer(null)
                }}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
                style={{ color: 'var(--crimson)' }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDrawer(null)} className="btn-secondary px-3.5 py-1.5 text-[13px]">
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="btn-primary px-4 py-1.5 text-[13px]">
              {existing ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div
            className="rounded-md border px-3 py-2 text-[12px]"
            style={{ backgroundColor: 'var(--crimson-tint)', borderColor: 'var(--crimson)', color: 'var(--crimson)' }}
          >
            {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Prepare Unit 4 worksheet"
            className="ledger-control w-full px-3 py-2 text-[14px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="ledger-control w-full px-2.5 py-2 text-[13px]"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="ledger-control w-full px-2.5 py-2 text-[13px]"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Due Time
            </label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Est. (min)
            </label>
            <input
              type="number"
              min={0}
              value={estimatedMin}
              onChange={(e) => setEstimatedMin(e.target.value)}
              placeholder="25"
              className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="prep, billing, physics"
              className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Actual Duration (min)
            </label>
            <input
              type="number"
              min={0}
              value={actualMin}
              onChange={(e) => setActualMin(e.target.value)}
              placeholder="0"
              className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
        </div>

        {/* Cross-entity linking */}
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
        >
          <div className="mb-2 text-[12px] font-semibold">Link to Student / Lesson</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                Student / Gig
              </label>
              <select
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value)
                  if (lessonId) setLessonId('')
                }}
                className="ledger-control w-full px-2.5 py-1.5 text-[12px]"
              >
                <option value="">None (general task)</option>
                {state.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.subject})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                Specific Lesson
              </label>
              <select
                value={lessonId}
                onChange={(e) => {
                  const val = e.target.value
                  setLessonId(val)
                  if (val && !studentId) {
                    const les = state.lessons.find((l) => l.id === val)
                    if (les) setStudentId(les.studentId)
                  }
                }}
                className="ledger-control w-full px-2.5 py-1.5 text-[12px]"
              >
                <option value="">None</option>
                {filteredLessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.date} · {studentMap.get(l.studentId) ?? ''} — {l.topic}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Recurrence */}
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
        >
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
            <Repeat className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span>Recurrence</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FREQUENCIES.map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => setFrequency(freq)}
                className="rounded-md border px-2.5 py-1 text-[12px] font-medium"
                style={{
                  backgroundColor: frequency === freq ? 'var(--accent)' : 'var(--bg-surface)',
                  color: frequency === freq ? 'var(--accent-ink)' : 'var(--ink-secondary)',
                  borderColor: frequency === freq ? 'var(--accent)' : 'var(--border-strong)',
                }}
              >
                {freq}
              </button>
            ))}
          </div>
          {(frequency === 'Weekly' || frequency === 'Biweekly') && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                Days:
              </span>
              {WEEKDAYS.map((dayName, idx) => {
                const active = weekDays.includes(idx)
                return (
                  <button
                    key={dayName}
                    type="button"
                    onClick={() => toggleWeekDay(idx)}
                    className="rounded border px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: active ? 'var(--accent-tint)' : 'var(--bg-surface)',
                      color: active ? 'var(--accent)' : 'var(--ink-secondary)',
                      borderColor: active ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    {dayName}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Nested Subtasks */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Subtasks
            </span>
            {subtasks.length > 0 && (
              <span className="tabular-nums text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                {completedSub}/{subtasks.length} done
              </span>
            )}
          </div>
          {subtasks.length > 0 && (
            <div
              className="mb-2 h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round((completedSub / subtasks.length) * 100)}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>
          )}
          <div className="space-y-1.5">
            {subtasks.map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-[13px]"
                style={{ borderColor: 'var(--border)' }}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={st.done}
                    onChange={() =>
                      setSubtasks((prev) =>
                        prev.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)),
                      )
                    }
                  />
                  <span className={st.done ? 'line-through opacity-60' : ''}>{st.title}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setSubtasks((prev) => prev.filter((x) => x.id !== st.id))}
                  aria-label="Remove subtask"
                  className="text-[11px] hover:opacity-75"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddSubtask()
                }
              }}
              placeholder="Add subtask step…"
              className="ledger-control flex-1 px-2.5 py-1.5 text-[13px]"
            />
            <button
              type="button"
              onClick={handleAddSubtask}
              className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-[12px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Markdown Notes */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Notes (Markdown)
            </label>
            <button
              type="button"
              onClick={() => setPreviewNotes((p) => !p)}
              className="text-[11px] font-medium underline"
              style={{ color: 'var(--accent)' }}
            >
              {previewNotes ? 'Edit Markdown' : 'Preview'}
            </button>
          </div>
          {previewNotes ? (
            <div
              className="min-h-24 rounded-md border p-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
            >
              <MarkdownText content={notes} />
            </div>
          ) : (
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lesson prep notes, checklists, resource links…"
              className="ledger-control w-full px-3 py-2 text-[13px]"
            />
          )}
        </div>
      </div>
    </Drawer>
  )
}
