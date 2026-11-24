import type { PaymentStatus, TaskPriority, TaskStatus } from '../domain/types'

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const palette: Record<TaskPriority, { bg: string; fg: string; dot: string }> = {
    Urgent: { bg: 'var(--crimson-tint)', fg: 'var(--crimson)', dot: 'var(--crimson)' },
    High: { bg: 'var(--terracotta-tint)', fg: 'var(--terracotta)', dot: 'var(--terracotta)' },
    Medium: { bg: 'var(--ochre-tint)', fg: 'var(--ochre)', dot: 'var(--ochre)' },
    Low: { bg: 'var(--bg-subtle)', fg: 'var(--ink-secondary)', dot: 'var(--ink-muted)' },
  }
  const style = palette[priority]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      {priority}
    </span>
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { bg: string; fg: string }> = {
    Inbox: { bg: 'var(--bg-subtle)', fg: 'var(--ink-secondary)' },
    'To Do': { bg: 'var(--ochre-tint)', fg: 'var(--ochre)' },
    'In Progress': { bg: 'var(--accent-tint)', fg: 'var(--accent)' },
    Waiting: { bg: 'var(--terracotta-tint)', fg: 'var(--terracotta)' },
    Done: { bg: 'var(--sage-tint)', fg: 'var(--sage)' },
  }
  const st = map[status]
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: st.bg, color: st.fg }}
    >
      {status}
    </span>
  )
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { bg: string; fg: string }> = {
    Paid: { bg: 'var(--sage-tint)', fg: 'var(--sage)' },
    Invoiced: { bg: 'var(--ochre-tint)', fg: 'var(--ochre)' },
    Unpaid: { bg: 'var(--crimson-tint)', fg: 'var(--crimson)' },
    'Covered by Retainer/Package': { bg: 'var(--accent-tint)', fg: 'var(--accent)' },
  }
  const st = map[status]
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: st.bg, color: st.fg }}
    >
      {status === 'Covered by Retainer/Package' ? 'Covered' : status}
    </span>
  )
}
