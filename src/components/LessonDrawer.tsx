import { useEffect, useMemo, useState } from 'react'
import { Play, Plus, Trash2 } from 'lucide-react'
import { createId, useLedger } from '../context/LedgerContext'
import {
  computeLessonCharge,
  computePackageLedger,
  computeRetainerLedger,
  defaultPaymentStatusForStudent,
} from '../domain/billing'
import {
  formatMoney,
  minorToEditableString,
  parseMajorToMinor,
} from '../domain/money'
import type {
  DeliveryMode,
  Lesson,
  LessonStatus,
  PaymentMethod,
  PaymentStatus,
} from '../domain/types'
import { Drawer } from './Drawer'

const LESSON_STATUSES: LessonStatus[] = [
  'Scheduled',
  'Completed',
  'Cancelled — Excused',
  'Cancelled — Billable/No-Show',
]
const DELIVERY_MODES: DeliveryMode[] = ['Online', 'In-Person', 'Hybrid']
const PAYMENT_STATUSES: PaymentStatus[] = [
  'Unpaid',
  'Invoiced',
  'Paid',
  'Covered by Retainer/Package',
]
const PAYMENT_METHODS: PaymentMethod[] = ['Bank Transfer', 'Cash', 'Card', 'Other']

export function LessonDrawer() {
  const {
    state,
    today,
    drawer,
    setDrawer,
    upsertLesson,
    deleteLesson,
    toggleTaskDone,
    startTimer,
  } = useLedger()
  const isOpen = drawer?.kind === 'lesson'
  const existing =
    isOpen && drawer.lessonId
      ? state.lessons.find((l) => l.id === drawer.lessonId)
      : undefined

  const [studentId, setStudentId] = useState('')
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('16:00')
  const [plannedDurationMin, setPlannedDurationMin] = useState('60')
  const [actualDurationMin, setActualDurationMin] = useState('60')
  const [prepMinutes, setPrepMinutes] = useState('0')
  const [topic, setTopic] = useState('')
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('Online')
  const [status, setStatus] = useState<LessonStatus>('Completed')
  const [useOverride, setUseOverride] = useState(false)
  const [overrideAmount, setOverrideAmount] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid')
  const [paidDate, setPaidDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer')
  const [homeworkAssigned, setHomeworkAssigned] = useState('')
  const [nextLessonPlan, setNextLessonPlan] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    if (existing) {
      setStudentId(existing.studentId)
      setDate(existing.date)
      setStartTime(existing.startTime)
      setPlannedDurationMin(String(existing.plannedDurationMin))
      const dur = drawer.initialDurationMin ?? existing.actualDurationMin
      setActualDurationMin(String(dur))
      setPrepMinutes(String(existing.prepMinutes ?? 0))
      setTopic(existing.topic)
      setDeliveryMode(existing.deliveryMode)
      setStatus(drawer.initialDurationMin !== undefined ? 'Completed' : existing.status)
      setUseOverride(existing.manualOverrideMinor !== undefined)
      setOverrideAmount(
        existing.manualOverrideMinor !== undefined
          ? minorToEditableString(existing.manualOverrideMinor, state.settings.currency)
          : '',
      )
      setOverrideReason(existing.overrideReason ?? '')
      setPaymentStatus(existing.paymentStatus)
      setPaidDate(existing.paidDate ?? '')
      setPaymentMethod(existing.paymentMethod ?? 'Bank Transfer')
      setHomeworkAssigned(existing.homeworkAssigned)
      setNextLessonPlan(existing.nextLessonPlan)
    } else {
      const initialStudent =
        state.students.find((s) => s.id === drawer.initialStudentId) ??
        state.students.find((s) => s.status === 'Active') ??
        state.students[0]
      const defDur = String(drawer.initialDurationMin ?? state.settings.defaultLessonDurationMin)
      setStudentId(initialStudent?.id ?? '')
      setDate(drawer.initialDate ?? today)
      setStartTime(drawer.initialStartTime ?? '16:00')
      setPlannedDurationMin(defDur)
      setActualDurationMin(defDur)
      setPrepMinutes('0')
      setTopic('')
      setDeliveryMode(initialStudent?.deliveryMode ?? 'Online')
      const defaultStat: LessonStatus =
        drawer.initialDurationMin !== undefined || (drawer.initialDate ?? today) <= today
          ? 'Completed'
          : 'Scheduled'
      setStatus(defaultStat)
      setUseOverride(false)
      setOverrideAmount('')
      setOverrideReason('')
      setPaymentStatus(defaultPaymentStatusForStudent(initialStudent))
      setPaidDate('')
      setPaymentMethod('Bank Transfer')
      setHomeworkAssigned('')
      setNextLessonPlan('')
    }
  }, [isOpen, existing, drawer, state.students, state.settings, today])

  const selectedStudent = state.students.find((s) => s.id === studentId)

  const handleStudentChange = (nextId: string) => {
    setStudentId(nextId)
    const st = state.students.find((s) => s.id === nextId)
    if (st && !existing) {
      setDeliveryMode(st.deliveryMode)
      setPaymentStatus(defaultPaymentStatusForStudent(st))
    }
  }

  const previewDraft: Lesson = useMemo(() => {
    const manualMinor = useOverride
      ? parseMajorToMinor(overrideAmount, state.settings.currency)
      : undefined
    return {
      id: existing?.id ?? '__draft__',
      studentId,
      date: date || today,
      startTime: startTime || '16:00',
      plannedDurationMin: Math.max(0, Number.parseInt(plannedDurationMin, 10) || 0),
      actualDurationMin: Math.max(0, Number.parseInt(actualDurationMin, 10) || 0),
      prepMinutes: Math.max(0, Number.parseInt(prepMinutes, 10) || 0),
      topic,
      deliveryMode,
      status,
      manualOverrideMinor: manualMinor,
      overrideReason: useOverride ? overrideReason : undefined,
      paymentStatus,
      paidDate: paymentStatus === 'Paid' ? paidDate || today : undefined,
      paymentMethod: paymentStatus === 'Paid' ? paymentMethod : undefined,
      homeworkAssigned,
      nextLessonPlan,
    }
  }, [
    existing?.id,
    studentId,
    date,
    today,
    startTime,
    plannedDurationMin,
    actualDurationMin,
    prepMinutes,
    topic,
    deliveryMode,
    status,
    useOverride,
    overrideAmount,
    overrideReason,
    state.settings.currency,
    paymentStatus,
    paidDate,
    paymentMethod,
    homeworkAssigned,
    nextLessonPlan,
  ])

  const chargePreview = useMemo(() => {
    if (!selectedStudent) return { computedPriceMinor: 0, effectivePriceMinor: 0, isCoveredByPlan: false }
    const simulatedLessons = existing
      ? state.lessons.map((l) => (l.id === existing.id ? previewDraft : l))
      : [...state.lessons, previewDraft]
    const ret =
      selectedStudent.billingModel.type === 'retainer'
        ? computeRetainerLedger(selectedStudent, simulatedLessons, state.retainerPayments, today)
        : undefined
    const pkg =
      selectedStudent.billingModel.type === 'package'
        ? computePackageLedger(selectedStudent, simulatedLessons)
        : undefined
    return computeLessonCharge(selectedStudent, previewDraft, ret, pkg)
  }, [selectedStudent, existing, state.lessons, state.retainerPayments, previewDraft, today])

  const linkedTasks = existing
    ? state.tasks.filter((t) => t.lessonId === existing.id)
    : []

  const buildLessonObject = (idOverride?: string): Lesson => ({
    ...previewDraft,
    id: idOverride ?? existing?.id ?? createId('les'),
  })

  const handleSave = () => {
    if (!studentId) {
      setError('Select a student/gig first (or add a student under Students & Gigs).')
      return
    }
    const lesson = buildLessonObject()
    upsertLesson(lesson)
    setDrawer(null)
  }

  return (
    <Drawer
      open={isOpen}
      title={existing ? 'Lesson Details' : 'Log or Schedule Lesson'}
      subtitle={selectedStudent ? `${selectedStudent.name} · ${selectedStudent.subject}` : undefined}
      onClose={() => setDrawer(null)}
      wide
      footer={
        <>
          <div className="flex items-center gap-2">
            {existing && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    deleteLesson(existing.id)
                    setDrawer(null)
                  }}
                  className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
                  style={{ color: 'var(--crimson)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    startTimer(existing.studentId, existing.id, existing.topic)
                    setDrawer(null)
                  }}
                  className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Start Timer</span>
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDrawer(null)} className="btn-secondary px-3.5 py-1.5 text-[13px]">
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="btn-primary px-4 py-1.5 text-[13px]">
              {existing ? 'Save Lesson' : 'Save Lesson'}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Student / Gig
            </label>
            <select
              value={studentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="ledger-control w-full px-2.5 py-2 text-[13px]"
            >
              <option value="">Select student…</option>
              {state.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.subject}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                const nextStatus = e.target.value as LessonStatus
                setStatus(nextStatus)
                if (nextStatus === 'Cancelled — Excused') {
                  setUseOverride(false)
                }
              }}
              className="ledger-control w-full px-2.5 py-2 text-[13px]"
            >
              {LESSON_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="col-span-2">
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
              Start
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Plan (m)
            </label>
            <input
              type="number"
              min={0}
              value={plannedDurationMin}
              onChange={(e) => setPlannedDurationMin(e.target.value)}
              className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Actual (m)
            </label>
            <input
              type="number"
              min={0}
              value={actualDurationMin}
              onChange={(e) => setActualDurationMin(e.target.value)}
              className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Topic / Curriculum Covered
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Wave Phenomena & Standing Harmonics"
              className="ledger-control w-full px-3 py-1.5 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Delivery Mode
            </label>
            <select
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
              className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
            >
              {DELIVERY_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedStudent?.billingModel.type === 'hourly' && selectedStudent.billingModel.billPrepTime && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
                Billable Prep Time (min)
              </label>
              <input
                type="number"
                min={0}
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(e.target.value)}
                className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
              />
            </div>
            <div className="flex items-end pb-1.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
              Added to hourly proration for this student
            </div>
          </div>
        )}

        {/* Computed charge + payment ledger */}
        <div
          className="rounded-lg border p-3.5"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[12px] font-semibold">Lesson Fee &amp; Payment</div>
              {chargePreview.planNote && (
                <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  {chargePreview.planNote}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="tabular-nums text-lg font-semibold" style={{ color: 'var(--accent)' }}>
                {formatMoney(chargePreview.effectivePriceMinor, state.settings.currency)}
              </div>
              {useOverride && (
                <div className="tabular-nums text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  Computed: {formatMoney(chargePreview.computedPriceMinor, state.settings.currency)}
                </div>
              )}
            </div>
          </div>

          <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={useOverride}
              onChange={(e) => {
                setUseOverride(e.target.checked)
                if (e.target.checked && !overrideAmount) {
                  setOverrideAmount(
                    minorToEditableString(
                      chargePreview.computedPriceMinor,
                      state.settings.currency,
                    ),
                  )
                }
              }}
            />
            <span>Manual fee override</span>
          </label>

          {useOverride && (
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  Override Amount ({state.settings.currency})
                </label>
                <input
                  type="text"
                  value={overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                  className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  Override Reason
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g., Discounted half no-show fee"
                  className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
                />
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="ledger-control w-full px-2.5 py-1.5 text-[12px]"
              >
                {PAYMENT_STATUSES.map((ps) => (
                  <option key={ps} value={ps}>
                    {ps}
                  </option>
                ))}
              </select>
            </div>
            {paymentStatus === 'Paid' && (
              <>
                <div>
                  <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    Paid Date
                  </label>
                  <input
                    type="date"
                    value={paidDate || today}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[12px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="ledger-control w-full px-2.5 py-1.5 text-[12px]"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Homework Assigned
            </label>
            <textarea
              rows={2}
              value={homeworkAssigned}
              onChange={(e) => setHomeworkAssigned(e.target.value)}
              placeholder="Problem set, pages, practice drill…"
              className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Next Lesson Plan
            </label>
            <textarea
              rows={2}
              value={nextLessonPlan}
              onChange={(e) => setNextLessonPlan(e.target.value)}
              placeholder="Focus areas for next session…"
              className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
            />
          </div>
        </div>

        {/* Linked Prep Tasks */}
        {existing && (
          <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold">Linked Prep Tasks</span>
              <button
                type="button"
                onClick={() => {
                  const saved = buildLessonObject(existing.id)
                  upsertLesson(saved)
                  setDrawer({
                    kind: 'task',
                    initialStudentId: saved.studentId,
                    initialLessonId: saved.id,
                  })
                }}
                className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
              >
                <Plus className="h-3 w-3" />
                <span>Add Prep Task</span>
              </button>
            </div>
            {linkedTasks.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                No prep tasks linked to this session yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {linkedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-[12px]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={t.status === 'Done'}
                        onChange={() => toggleTaskDone(t.id)}
                      />
                      <span className={t.status === 'Done' ? 'truncate line-through opacity-60' : 'truncate'}>
                        {t.title}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setDrawer({ kind: 'task', taskId: t.id })}
                      className="text-[11px] font-medium underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}
