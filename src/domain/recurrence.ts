import { addDaysISO, addMonthsClamped, parseISODate, todayISO } from './dates'
import type { RecurrenceRule, Task } from './types'

export function computeNextOccurrenceDate(dueDateISO: string, rule: RecurrenceRule): string {
  switch (rule.frequency) {
    case 'Daily':
      return addDaysISO(dueDateISO, 1)
    case 'Weekly': {
      const days = (rule.weekDays ?? []).filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b)
      if (days.length === 0) return addDaysISO(dueDateISO, 7)
      const currentDay = parseISODate(dueDateISO).getDay()
      const laterSameWeek = days.find((d) => d > currentDay)
      if (laterSameWeek !== undefined) {
        return addDaysISO(dueDateISO, laterSameWeek - currentDay)
      }
      const firstNextWeek = days[0]
      return addDaysISO(dueDateISO, 7 - currentDay + firstNextWeek)
    }
    case 'Biweekly': {
      const days = (rule.weekDays ?? []).filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b)
      if (days.length === 0) return addDaysISO(dueDateISO, 14)
      const currentDay = parseISODate(dueDateISO).getDay()
      const laterSameWeek = days.find((d) => d > currentDay)
      if (laterSameWeek !== undefined) {
        return addDaysISO(dueDateISO, laterSameWeek - currentDay)
      }
      return addDaysISO(dueDateISO, 14 - currentDay + days[0])
    }
    case 'Monthly':
      return addMonthsClamped(dueDateISO, 1)
    case 'None':
    default:
      return dueDateISO
  }
}

export function spawnNextRecurringTask(
  task: Task,
  nextId: string,
  anchorToday = todayISO(),
): Task | null {
  if (task.recurrence.frequency === 'None') return null
  const baseDate = task.dueDate ?? anchorToday
  const nextDue = computeNextOccurrenceDate(baseDate, task.recurrence)
  return {
    ...task,
    id: nextId,
    status: 'To Do',
    dueDate: nextDue,
    actualDurationMin: undefined,
    completedAt: undefined,
    createdAt: new Date().toISOString(),
    subtasks: task.subtasks.map((st, idx) => ({
      ...st,
      id: `${nextId}-sub-${idx + 1}`,
      done: false,
    })),
  }
}

export function completeTaskWithRecurrence(
  tasks: Task[],
  taskId: string,
  createId: () => string,
  anchorToday = todayISO(),
): { tasks: Task[]; spawned: Task | null } {
  let spawned: Task | null = null
  const nextTasks = tasks.map((task) => {
    if (task.id !== taskId) return task
    const wasDone = task.status === 'Done'
    const updated: Task = {
      ...task,
      status: 'Done',
      completedAt: task.completedAt ?? anchorToday,
    }
    if (!wasDone && task.recurrence.frequency !== 'None') {
      spawned = spawnNextRecurringTask(updated, createId(), anchorToday)
    }
    return updated
  })
  if (spawned) {
    nextTasks.unshift(spawned)
  }
  return { tasks: nextTasks, spawned }
}
