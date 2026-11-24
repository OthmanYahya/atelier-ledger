import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { createId, useLedger } from '../context/LedgerContext'
import { minorToEditableString, parseMajorToMinor } from '../domain/money'
import type { Expense, ExpenseCategory, PaymentMethod } from '../domain/types'
import { Drawer } from './Drawer'

const CATEGORIES: ExpenseCategory[] = [
  'Transport/Fuel',
  'Teaching Materials & Printing',
  'Software & Tools',
  'Equipment',
  'Utilities/Internet',
  'Other',
]

const METHODS: PaymentMethod[] = ['Card', 'Cash', 'Bank Transfer', 'Other']

export function ExpenseDrawer() {
  const { state, today, drawer, setDrawer, upsertExpense, deleteExpense } = useLedger()
  const isOpen = drawer?.kind === 'expense'
  const existing =
    isOpen && drawer.expenseId
      ? state.expenses.find((e) => e.id === drawer.expenseId)
      : undefined
  const cur = state.settings.currency

  const [date, setDate] = useState(today)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('Teaching Materials & Printing')
  const [amount, setAmount] = useState('')
  const [isRecurringMonthly, setIsRecurringMonthly] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Card')
  const [studentId, setStudentId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    if (existing) {
      setDate(existing.date)
      setTitle(existing.title)
      setCategory(existing.category)
      setAmount(minorToEditableString(existing.amountMinor, cur))
      setIsRecurringMonthly(existing.isRecurringMonthly)
      setPaymentMethod(existing.paymentMethod)
      setStudentId(existing.studentId ?? '')
      setNotes(existing.notes)
    } else {
      setDate(today)
      setTitle('')
      setCategory('Teaching Materials & Printing')
      setAmount('')
      setIsRecurringMonthly(false)
      setPaymentMethod('Card')
      setStudentId('')
      setNotes('')
    }
  }, [isOpen, existing, cur, today])

  const handleSave = () => {
    if (!title.trim()) {
      setError('Expense title is required.')
      return
    }
    const minor = parseMajorToMinor(amount, cur)
    if (minor <= 0) {
      setError('Enter an amount greater than 0.')
      return
    }
    const expense: Expense = {
      id: existing?.id ?? createId('exp'),
      date: date || today,
      title: title.trim(),
      category,
      amountMinor: minor,
      isRecurringMonthly,
      paymentMethod,
      notes: notes.trim(),
      studentId: studentId || undefined,
    }
    upsertExpense(expense)
    setDrawer(null)
  }

  return (
    <Drawer
      open={isOpen}
      title={existing ? 'Edit Expense' : 'Log Expense'}
      subtitle="Track studio costs and attribute direct gig expenses"
      onClose={() => setDrawer(null)}
      footer={
        <>
          <div>
            {existing && (
              <button
                type="button"
                onClick={() => {
                  deleteExpense(existing.id)
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
              Save Expense
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
            placeholder="e.g., Printed past papers or Fuel pass"
            className="ledger-control w-full px-3 py-2 text-[14px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Amount ({cur})
            </label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="24.50"
              className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
            Attribute to Student / Gig (optional)
          </label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
          >
            <option value="">General Studio Expense</option>
            {state.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.subject}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={isRecurringMonthly}
            onChange={(e) => setIsRecurringMonthly(e.target.checked)}
          />
          <span>Recurring monthly expense</span>
        </label>

        <div>
          <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
            Notes
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Receipt reference or details…"
            className="ledger-control w-full px-3 py-2 text-[13px]"
          />
        </div>
      </div>
    </Drawer>
  )
}
