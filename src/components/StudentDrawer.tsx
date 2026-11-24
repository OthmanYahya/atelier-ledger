import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FileText, Plus, Trash2 } from 'lucide-react'
import { createId, useLedger } from '../context/LedgerContext'
import {
  computePackageLedger,
  computeRetainerLedger,
  formatPackageCredits,
} from '../domain/billing'
import {
  formatMoney,
  minorToEditableString,
  parseMajorToMinor,
} from '../domain/money'
import type {
  BillingModel,
  DeliveryMode,
  PaymentMethod,
  Student,
  StudentStatus,
} from '../domain/types'
import { Drawer } from './Drawer'

const DELIVERY_MODES: DeliveryMode[] = ['Online', 'In-Person', 'Hybrid']
const STUDENT_STATUSES: StudentStatus[] = ['Active', 'Paused', 'Archived']

export function StudentDrawer() {
  const {
    state,
    today,
    drawer,
    setDrawer,
    upsertStudent,
    deleteStudent,
    addPackagePurchase,
    markPackagePurchasePaid,
    setRetainerCycleStatus,
    toggleTaskDone,
  } = useLedger()
  const isOpen = drawer?.kind === 'student'
  const existing =
    isOpen && drawer.studentId
      ? state.students.find((s) => s.id === drawer.studentId)
      : undefined
  const cur = state.settings.currency

  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [contact, setContact] = useState('')
  const [notes, setNotes] = useState('')
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('Online')
  const [status, setStatus] = useState<StudentStatus>('Active')
  const [billingType, setBillingType] = useState<BillingModel['type']>('hourly')

  // Hourly
  const [hourlyRate, setHourlyRate] = useState('')
  const [billPrepTime, setBillPrepTime] = useState(false)

  // Flat
  const [flatRate, setFlatRate] = useState('')

  // Retainer
  const [monthlyFee, setMonthlyFee] = useState('')
  const [cycleStartDay, setCycleStartDay] = useState('1')
  const [includedHours, setIncludedHours] = useState('')
  const [includedSessions, setIncludedSessions] = useState('')
  const [rolloverUnused, setRolloverUnused] = useState(false)
  const [overageRate, setOverageRate] = useState('')

  // Package
  const [pkgUnit, setPkgUnit] = useState<'lessons' | 'hours'>('lessons')
  const [pkgUnits, setPkgUnits] = useState('10')
  const [pkgPrice, setPkgPrice] = useState('')
  const [newBundleUnits, setNewBundleUnits] = useState('10')
  const [newBundlePrice, setNewBundlePrice] = useState('')
  const [newBundleLabel, setNewBundleLabel] = useState('')
  const [newBundleStatus, setNewBundleStatus] = useState<'Paid' | 'Invoiced' | 'Unpaid'>('Paid')
  const [newBundleMethod, setNewBundleMethod] = useState<PaymentMethod>('Bank Transfer')

  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    if (existing) {
      setName(existing.name)
      setSubject(existing.subject)
      setContact(existing.contact)
      setNotes(existing.notes)
      setDeliveryMode(existing.deliveryMode)
      setStatus(existing.status)
      setBillingType(existing.billingModel.type)

      const m = existing.billingModel
      setHourlyRate(
        m.type === 'hourly'
          ? minorToEditableString(m.ratePerHourMinor, cur)
          : minorToEditableString(state.settings.defaultHourlyRateMinor, cur),
      )
      setBillPrepTime(m.type === 'hourly' ? m.billPrepTime : false)
      setFlatRate(
        m.type === 'flat'
          ? minorToEditableString(m.ratePerSessionMinor, cur)
          : minorToEditableString(state.settings.defaultHourlyRateMinor, cur),
      )
      setMonthlyFee(
        m.type === 'retainer' ? minorToEditableString(m.monthlyFeeMinor, cur) : '400',
      )
      setCycleStartDay(m.type === 'retainer' ? String(m.cycleStartDay) : '1')
      setIncludedHours(
        m.type === 'retainer' && m.includedHours !== null ? String(m.includedHours) : '',
      )
      setIncludedSessions(
        m.type === 'retainer' && m.includedSessions !== null ? String(m.includedSessions) : '',
      )
      setRolloverUnused(m.type === 'retainer' ? m.rolloverUnused : false)
      setOverageRate(
        m.type === 'retainer'
          ? minorToEditableString(m.overageRatePerHourMinor, cur)
          : minorToEditableString(state.settings.defaultHourlyRateMinor, cur),
      )
      setPkgUnit(m.type === 'package' ? m.unit : 'lessons')
      setPkgUnits(m.type === 'package' ? String(m.defaultBundleUnits) : '10')
      setPkgPrice(
        m.type === 'package'
          ? minorToEditableString(m.defaultBundlePriceMinor, cur)
          : minorToEditableString(state.settings.defaultHourlyRateMinor * 10, cur),
      )
      setNewBundleUnits(m.type === 'package' ? String(m.defaultBundleUnits) : '10')
      setNewBundlePrice(
        m.type === 'package'
          ? minorToEditableString(m.defaultBundlePriceMinor, cur)
          : minorToEditableString(state.settings.defaultHourlyRateMinor * 10, cur),
      )
      setNewBundleLabel('')
    } else {
      const defRateStr = minorToEditableString(state.settings.defaultHourlyRateMinor, cur)
      setName('')
      setSubject('')
      setContact('')
      setNotes('')
      setDeliveryMode('Online')
      setStatus('Active')
      setBillingType('hourly')
      setHourlyRate(defRateStr)
      setBillPrepTime(false)
      setFlatRate(defRateStr)
      setMonthlyFee(minorToEditableString(state.settings.defaultHourlyRateMinor * 6, cur))
      setCycleStartDay('1')
      setIncludedHours('6')
      setIncludedSessions('')
      setRolloverUnused(false)
      setOverageRate(defRateStr)
      setPkgUnit('lessons')
      setPkgUnits('10')
      setPkgPrice(minorToEditableString(state.settings.defaultHourlyRateMinor * 9, cur))
    }
  }, [isOpen, existing, cur, state.settings.defaultHourlyRateMinor])

  const retainerLedger = useMemo(() => {
    if (!existing || existing.billingModel.type !== 'retainer') return null
    return computeRetainerLedger(existing, state.lessons, state.retainerPayments, today)
  }, [existing, state.lessons, state.retainerPayments, today])

  const packageLedger = useMemo(() => {
    if (!existing || existing.billingModel.type !== 'package') return null
    return computePackageLedger(existing, state.lessons)
  }, [existing, state.lessons])

  const linkedTasks = existing ? state.tasks.filter((t) => t.studentId === existing.id) : []
  const recentLessons = existing
    ? state.lessons
        .filter((l) => l.studentId === existing.id)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6)
    : []

  const buildModel = (): BillingModel => {
    switch (billingType) {
      case 'hourly':
        return {
          type: 'hourly',
          ratePerHourMinor: Math.max(0, parseMajorToMinor(hourlyRate, cur)),
          billPrepTime,
        }
      case 'flat':
        return {
          type: 'flat',
          ratePerSessionMinor: Math.max(0, parseMajorToMinor(flatRate, cur)),
        }
      case 'retainer': {
        const hrs = includedHours.trim() ? Number.parseFloat(includedHours) : null
        const ses = includedSessions.trim() ? Number.parseInt(includedSessions, 10) : null
        return {
          type: 'retainer',
          monthlyFeeMinor: Math.max(0, parseMajorToMinor(monthlyFee, cur)),
          cycleStartDay: Math.max(1, Math.min(28, Number.parseInt(cycleStartDay, 10) || 1)),
          includedHours: hrs !== null && Number.isFinite(hrs) && hrs >= 0 ? hrs : null,
          includedSessions: ses !== null && Number.isFinite(ses) && ses >= 0 ? ses : null,
          rolloverUnused,
          overageRatePerHourMinor: Math.max(0, parseMajorToMinor(overageRate, cur)),
        }
      }
      case 'package': {
        const units = Math.max(1, Number.parseFloat(pkgUnits) || 10)
        const priceMinor = Math.max(0, parseMajorToMinor(pkgPrice, cur))
        const existingPurchases =
          existing?.billingModel.type === 'package' ? existing.billingModel.purchases : []
        const purchases =
          existingPurchases.length > 0
            ? existingPurchases
            : [
                {
                  id: createId('pkg'),
                  purchasedDate: today,
                  label: `${units}-${pkgUnit === 'lessons' ? 'Lesson' : 'Hour'} Initial Bundle`,
                  unitsGranted: pkgUnit === 'hours' ? Math.round(units * 60) : Math.round(units),
                  priceMinor,
                  paymentStatus: 'Paid' as const,
                  paidDate: today,
                  paymentMethod: 'Bank Transfer' as const,
                },
              ]
        return {
          type: 'package',
          unit: pkgUnit,
          defaultBundleUnits: units,
          defaultBundlePriceMinor: priceMinor,
          purchases,
        }
      }
    }
  }

  const handleSave = () => {
    if (!name.trim()) {
      setError('Student / client name is required.')
      return
    }
    const student: Student = {
      id: existing?.id ?? createId('stu'),
      name: name.trim(),
      subject: subject.trim() || 'Private Tutoring',
      contact: contact.trim(),
      notes: notes.trim(),
      deliveryMode,
      status,
      billingModel: buildModel(),
      createdAt: existing?.createdAt ?? today,
    }
    upsertStudent(student)
    setDrawer(null)
  }

  const handleAddBundle = () => {
    if (!existing) return
    const unitsVal = Math.max(1, Number.parseFloat(newBundleUnits) || 1)
    const priceVal = Math.max(0, parseMajorToMinor(newBundlePrice, cur))
    addPackagePurchase(existing.id, {
      purchasedDate: today,
      label:
        newBundleLabel.trim() ||
        `${unitsVal}-${pkgUnit === 'lessons' ? 'Lesson' : 'Hour'} Renewal`,
      unitsGranted: pkgUnit === 'hours' ? Math.round(unitsVal * 60) : Math.round(unitsVal),
      priceMinor: priceVal,
      paymentStatus: newBundleStatus,
      paidDate: newBundleStatus === 'Paid' ? today : undefined,
      paymentMethod: newBundleStatus === 'Paid' ? newBundleMethod : undefined,
    })
    setNewBundleLabel('')
  }

  return (
    <Drawer
      open={isOpen}
      title={existing ? existing.name : 'New Student / Tutoring Gig'}
      subtitle={existing ? existing.subject : 'Configure billing model, contact details, and curriculum notes'}
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
                    deleteStudent(existing.id)
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
                  onClick={() => setDrawer({ kind: 'statement', studentId: existing.id })}
                  className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Print Statement</span>
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDrawer(null)} className="btn-secondary px-3.5 py-1.5 text-[13px]">
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="btn-primary px-4 py-1.5 text-[13px]">
              {existing ? 'Save Profile' : 'Create Student'}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
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
              Student / Client Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Nadia Al-Mansoor"
              className="ledger-control w-full px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Subject / Topic
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., IB Physics HL"
              className="ledger-control w-full px-3 py-2 text-[13px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Contact Info
            </label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email or phone"
              className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
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
          <div>
            <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StudentStatus)}
              className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
            >
              {STUDENT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Billing Model Config */}
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
        >
          <div className="mb-2.5 text-[12px] font-semibold">Billing Model</div>
          <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {(
              [
                ['hourly', 'Hourly'],
                ['flat', 'Flat Session'],
                ['retainer', 'Monthly Retainer'],
                ['package', 'Prepaid Package'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setBillingType(key)}
                className="rounded-md border px-2.5 py-1.5 text-[12px] font-medium"
                style={{
                  backgroundColor: billingType === key ? 'var(--accent)' : 'var(--bg-surface)',
                  color: billingType === key ? 'var(--accent-ink)' : 'var(--ink-secondary)',
                  borderColor: billingType === key ? 'var(--accent)' : 'var(--border-strong)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {billingType === 'hourly' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  Hourly Rate ({cur})
                </label>
                <input
                  type="text"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
                />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={billPrepTime}
                    onChange={(e) => setBillPrepTime(e.target.checked)}
                  />
                  <span>Bill optional prep time per lesson</span>
                </label>
              </div>
            </div>
          )}

          {billingType === 'flat' && (
            <div>
              <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                Flat Rate Per Session ({cur})
              </label>
              <input
                type="text"
                value={flatRate}
                onChange={(e) => setFlatRate(e.target.value)}
                className="ledger-control tabular-nums w-full max-w-xs px-2.5 py-1.5 text-[13px]"
              />
            </div>
          )}

          {billingType === 'retainer' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    Monthly Fee ({cur})
                  </label>
                  <input
                    type="text"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    Cycle Start Day (1–28)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={cycleStartDay}
                    onChange={(e) => setCycleStartDay(e.target.value)}
                    className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    Overage Rate/hr ({cur})
                  </label>
                  <input
                    type="text"
                    value={overageRate}
                    onChange={(e) => setOverageRate(e.target.value)}
                    className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    Included Hours / Cycle
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={includedHours}
                    onChange={(e) => setIncludedHours(e.target.value)}
                    placeholder="Unlimited if blank"
                    className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    Included Sessions / Cycle
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={includedSessions}
                    onChange={(e) => setIncludedSessions(e.target.value)}
                    placeholder="Optional cap"
                    className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
                  />
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={rolloverUnused}
                      onChange={(e) => setRolloverUnused(e.target.checked)}
                    />
                    <span>Rollover unused cap</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {billingType === 'package' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  Credit Unit
                </label>
                <select
                  value={pkgUnit}
                  onChange={(e) => setPkgUnit(e.target.value as 'lessons' | 'hours')}
                  className="ledger-control w-full px-2.5 py-1.5 text-[13px]"
                >
                  <option value="lessons">Lessons</option>
                  <option value="hours">Hours</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  Default Bundle ({pkgUnit})
                </label>
                <input
                  type="number"
                  min={1}
                  value={pkgUnits}
                  onChange={(e) => setPkgUnits(e.target.value)}
                  className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  Bundle Price ({cur})
                </label>
                <input
                  type="text"
                  value={pkgPrice}
                  onChange={(e) => setPkgPrice(e.target.value)}
                  className="ledger-control tabular-nums w-full px-2.5 py-1.5 text-[13px]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Retainer Ledger */}
        {existing && existing.billingModel.type === 'retainer' && retainerLedger && (
          <div className="rounded-lg border p-3.5" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-2 text-[12px] font-semibold">Retainer Cycles &amp; Effective Rate</div>
            <div className="space-y-2">
              {retainerLedger.cycles
                .slice()
                .reverse()
                .map((c) => (
                  <div
                    key={c.cycleKey}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-[12px]"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
                  >
                    <div>
                      <div className="tabular-nums font-semibold">
                        {c.cycleKey} ({c.startISO} to {c.endISO})
                      </div>
                      <div className="tabular-nums text-[11px]" style={{ color: 'var(--ink-secondary)' }}>
                        {(c.billableMinutes / 60).toFixed(1)}h taught
                        {c.allowanceMinutes !== null && ` / ${(c.allowanceMinutes / 60).toFixed(1)}h cap`}
                        {c.rolloverInMinutes > 0 && ` (incl. ${(c.rolloverInMinutes / 60).toFixed(1)}h rollover)`}
                        {c.overageMinutes > 0 && ` · Overage ${formatMoney(c.overageTotalMinor, cur)}`}
                        {c.completedMinutes > 0 &&
                          ` · Eff. ${formatMoney(c.effectiveHourlyRateMinor, cur)}/hr`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={c.paymentStatus}
                        onChange={(e) =>
                          setRetainerCycleStatus(
                            existing.id,
                            c.cycleKey,
                            e.target.value as 'Unpaid' | 'Invoiced' | 'Paid',
                          )
                        }
                        className="ledger-control px-2 py-1 text-[11px]"
                      >
                        <option value="Unpaid">Unpaid</option>
                        <option value="Invoiced">Invoiced</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Live Package Balance & Top-up */}
        {existing && existing.billingModel.type === 'package' && packageLedger && (
          <div className="rounded-lg border p-3.5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[12px] font-semibold">Prepaid Package Balance</div>
                <div className="tabular-nums text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                  Remaining:{' '}
                  <strong>{formatPackageCredits(packageLedger.remainingUnits, packageLedger.unit)}</strong>
                  {' · '}Used: {formatPackageCredits(packageLedger.usedUnits, packageLedger.unit)} of{' '}
                  {formatPackageCredits(packageLedger.totalPurchasedUnits, packageLedger.unit)}
                </div>
              </div>
              {packageLedger.isLowCredit && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: 'var(--terracotta-tint)', color: 'var(--terracotta)' }}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Low credit
                </span>
              )}
            </div>

            <div className="mt-3 space-y-1.5">
              {existing.billingModel.purchases.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-[12px]"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
                >
                  <span className="tabular-nums">
                    {p.purchasedDate} · {p.label} · {formatMoney(p.priceMinor, cur)}
                  </span>
                  {p.paymentStatus === 'Paid' ? (
                    <span className="font-medium" style={{ color: 'var(--sage)' }}>
                      Paid
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markPackagePurchasePaid(existing.id, p.id)}
                      className="btn-secondary px-2 py-0.5 text-[11px]"
                    >
                      Mark Paid
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-2 text-[11px] font-semibold" style={{ color: 'var(--ink-secondary)' }}>
                Record Bundle Top-Up / Renewal
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input
                  type="text"
                  value={newBundleLabel}
                  onChange={(e) => setNewBundleLabel(e.target.value)}
                  placeholder="Bundle label"
                  className="ledger-control col-span-2 px-2 py-1 text-[12px]"
                />
                <input
                  type="number"
                  min={1}
                  value={newBundleUnits}
                  onChange={(e) => setNewBundleUnits(e.target.value)}
                  placeholder={pkgUnit}
                  className="ledger-control tabular-nums px-2 py-1 text-[12px]"
                />
                <input
                  type="text"
                  value={newBundlePrice}
                  onChange={(e) => setNewBundlePrice(e.target.value)}
                  placeholder={`Price (${cur})`}
                  className="ledger-control tabular-nums px-2 py-1 text-[12px]"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={newBundleStatus}
                    onChange={(e) =>
                      setNewBundleStatus(e.target.value as 'Paid' | 'Invoiced' | 'Unpaid')
                    }
                    className="ledger-control px-2 py-1 text-[11px]"
                  >
                    <option value="Paid">Paid upfront</option>
                    <option value="Invoiced">Invoiced</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                  {newBundleStatus === 'Paid' && (
                    <select
                      value={newBundleMethod}
                      onChange={(e) => setNewBundleMethod(e.target.value as PaymentMethod)}
                      className="ledger-control px-2 py-1 text-[11px]"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                      <option value="Cash">Cash</option>
                      <option value="Other">Other</option>
                    </select>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddBundle}
                  className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[12px]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Bundle</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
            Studio Notes &amp; Curriculum Goals
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Learning pace, exam dates, textbook references…"
            className="ledger-control w-full px-3 py-2 text-[13px]"
          />
        </div>

        {/* Linked Tasks & Recent Lessons */}
        {existing && (
          <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold">Linked Tasks ({linkedTasks.length})</span>
                <button
                  type="button"
                  onClick={() => setDrawer({ kind: 'task', initialStudentId: existing.id })}
                  className="text-[11px] font-medium underline"
                  style={{ color: 'var(--accent)' }}
                >
                  + Task
                </button>
              </div>
              {linkedTasks.length === 0 ? (
                <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                  No linked tasks.
                </p>
              ) : (
                <div className="space-y-1">
                  {linkedTasks.slice(0, 6).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-[12px]">
                      <input
                        type="checkbox"
                        checked={t.status === 'Done'}
                        onChange={() => toggleTaskDone(t.id)}
                      />
                      <button
                        type="button"
                        onClick={() => setDrawer({ kind: 'task', taskId: t.id })}
                        className={`truncate text-left hover:underline ${
                          t.status === 'Done' ? 'line-through opacity-60' : ''
                        }`}
                      >
                        {t.title}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold">Recent Lessons</span>
                <button
                  type="button"
                  onClick={() => setDrawer({ kind: 'lesson', initialStudentId: existing.id })}
                  className="text-[11px] font-medium underline"
                  style={{ color: 'var(--accent)' }}
                >
                  + Lesson
                </button>
              </div>
              {recentLessons.length === 0 ? (
                <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                  No lessons logged yet.
                </p>
              ) : (
                <div className="space-y-1">
                  {recentLessons.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setDrawer({ kind: 'lesson', lessonId: l.id })}
                      className="flex w-full items-center justify-between gap-2 text-left text-[12px] hover:underline"
                    >
                      <span className="truncate">{l.topic || 'Lesson'}</span>
                      <span className="tabular-nums shrink-0 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {l.date}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
