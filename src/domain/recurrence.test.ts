import { describe, expect, it } from 'vitest'
import { completeTaskWithRecurrence, computeNextOccurrenceDate } from './recurrence'
import type { Task } from './types'

describe('task recurrence', () => {
  it('computes daily, weekly specific days, biweekly, and clamped monthly dates', () => {
    expect(computeNextOccurrenceDate('2026-11-24', { frequency: 'Daily' })).toBe('2026-11-25')
    // 2026-11-24 is Tuesday (2). Next among Mon(1), Thu(4) is Thu 2026-11-26.
    expect(
      computeNextOccurrenceDate('2026-11-24', { frequency: 'Weekly', weekDays: [1, 4] }),
    ).toBe('2026-11-26')
    // After Thu (4), next Mon(1) is 2026-11-30.
    expect(
      computeNextOccurrenceDate('2026-11-26', { frequency: 'Weekly', weekDays: [1, 4] }),
    ).toBe('2026-11-30')
    expect(computeNextOccurrenceDate('2026-11-24', { frequency: 'Biweekly' })).toBe('2026-12-08')
    // Month-end clamping: Jan 31 -> Feb 28 (non-leap) or Feb 29 (leap)
    expect(computeNextOccurrenceDate('2026-01-31', { frequency: 'Monthly' })).toBe('2026-02-28')
    expect(computeNextOccurrenceDate('2024-01-31', { frequency: 'Monthly' })).toBe('2024-02-29')
  })

  it('spawns next occurrence with reset subtasks when completing a recurring task', () => {
    const task: Task = {
      id: 't1',
      title: 'Weekly Review',
      notes: 'Export backup',
      status: 'To Do',
      priority: 'Medium',
      tags: ['routine'],
      dueDate: '2026-11-20',
      subtasks: [
        { id: 's1', title: 'Check invoices', done: true },
        { id: 's2', title: 'Save JSON', done: true },
      ],
      recurrence: { frequency: 'Weekly', weekDays: [5] },
      createdAt: '2026-11-13',
    }
    const { tasks, spawned } = completeTaskWithRecurrence([task], 't1', () => 't2', '2026-11-24')
    expect(spawned).not.toBeNull()
    expect(spawned?.id).toBe('t2')
    expect(spawned?.dueDate).toBe('2026-11-27')
    expect(spawned?.status).toBe('To Do')
    expect(spawned?.subtasks.every((s) => !s.done)).toBe(true)
    expect(tasks.find((t) => t.id === 't1')?.status).toBe('Done')
  })
})
