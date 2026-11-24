import { addDaysISO, todayISO } from './dates'
import { formatMoney } from './money'
import type {
  Expense,
  LedgerState,
  Lesson,
  Student,
  WorkspaceSettings,
} from './types'

export const STORAGE_KEY = 'atelier-ledger.v1'
export const CORRUPT_BACKUP_KEY = 'atelier-ledger.corrupt-backup'
export const IDB_NAME = 'atelier-ledger-db'
export const IDB_STORE = 'ledger'
export const IDB_KEY = 'current'

// shortcut: browser-local IndexedDB store + optional GitHub Gist sync (no dedicated backend server), upgrade to PocketBase/Node+SQLite if multi-user concurrency is ever needed.

export function createDefaultSettings(): WorkspaceSettings {
  return {
    currency: 'USD',
    defaultHourlyRateMinor: 6500,
    defaultLessonDurationMin: 60,
    workingHoursStart: '09:00',
    workingHoursEnd: '19:00',
    theme: 'paper',
  }
}

export function createEmptyLedgerState(
  settings: WorkspaceSettings = createDefaultSettings(),
): LedgerState {
  return {
    schemaVersion: 1,
    demoLoaded: false,
    settings,
    students: [],
    lessons: [],
    retainerPayments: [],
    expenses: [],
    tasks: [],
    timer: {
      running: false,
      startedAtMs: null,
      accumulatedMs: 0,
    },
  }
}

export function createDemoLedgerState(anchorToday = todayISO()): LedgerState {
  const settings = createDefaultSettings()

  const students: Student[] = [
    {
      id: 'stu-nadia',
      name: 'Nadia Al-Mansoor',
      subject: 'IB Physics HL',
      contact: 'nadia.almansoor@example.com',
      notes: 'Targeting 7 on May Paper 2. Prefers worked past-paper drills and derivation sheets.',
      deliveryMode: 'Online',
      status: 'Active',
      billingModel: {
        type: 'hourly',
        ratePerHourMinor: 7500,
        billPrepTime: true,
      },
      createdAt: addDaysISO(anchorToday, -45),
    },
    {
      id: 'stu-tomasz',
      name: 'Tomasz Kowalski',
      subject: 'Classical Piano & Theory',
      contact: '+1 (555) 284-1940',
      notes: 'Chopin Ballade No. 1 + Grade 7 harmony. Studio upright piano on Tuesdays/Fridays.',
      deliveryMode: 'In-Person',
      status: 'Active',
      billingModel: {
        type: 'retainer',
        monthlyFeeMinor: 42000,
        cycleStartDay: 1,
        includedHours: 6,
        includedSessions: null,
        rolloverUnused: true,
        overageRatePerHourMinor: 8000,
      },
      createdAt: addDaysISO(anchorToday, -60),
    },
    {
      id: 'stu-priya',
      name: 'Priya Ramanathan',
      subject: 'Algorithms & Systems Prep',
      contact: 'priya.r@example.com',
      notes: 'Dynamic programming & graph traversals. Currently at 2 credits left — remind for renewal.',
      deliveryMode: 'Online',
      status: 'Active',
      billingModel: {
        type: 'package',
        unit: 'lessons',
        defaultBundleUnits: 10,
        defaultBundlePriceMinor: 65000,
        purchases: [
          {
            id: 'pkg-priya-1',
            purchasedDate: addDaysISO(anchorToday, -28),
            label: '10-Lesson Interview Bundle',
            unitsGranted: 10,
            priceMinor: 65000,
            paymentStatus: 'Paid',
            paidDate: addDaysISO(anchorToday, -28),
            paymentMethod: 'Bank Transfer',
          },
        ],
      },
      createdAt: addDaysISO(anchorToday, -30),
    },
    {
      id: 'stu-liam',
      name: "Liam O'Connor",
      subject: 'AP Calculus BC',
      contact: 'parent.oconnor@example.com',
      notes: 'Series convergence & polar area units. Flat rate per session; parent settles via bank transfer.',
      deliveryMode: 'Hybrid',
      status: 'Active',
      billingModel: {
        type: 'flat',
        ratePerSessionMinor: 8500,
      },
      createdAt: addDaysISO(anchorToday, -24),
    },
  ]

  const currentMonthKey = anchorToday.slice(0, 7)
  const prevMonthDate = addDaysISO(`${currentMonthKey}-01`, -5)
  const prevMonthKey = prevMonthDate.slice(0, 7)

  const retainerPayments = [
    {
      id: 'ret-tomasz-prev',
      studentId: 'stu-tomasz',
      cycleKey: prevMonthKey,
      paymentStatus: 'Paid' as const,
      paidDate: `${prevMonthKey}-02`,
      paymentMethod: 'Bank Transfer' as const,
    },
    {
      id: 'ret-tomasz-curr',
      studentId: 'stu-tomasz',
      cycleKey: currentMonthKey,
      paymentStatus: 'Paid' as const,
      paidDate: `${currentMonthKey}-03`,
      paymentMethod: 'Bank Transfer' as const,
    },
  ]

  const lessons: Lesson[] = [
    // Past 2 weeks & earlier
    {
      id: 'les-1',
      studentId: 'stu-nadia',
      date: addDaysISO(anchorToday, -13),
      startTime: '16:00',
      plannedDurationMin: 60,
      actualDurationMin: 75,
      prepMinutes: 15,
      topic: 'Wave Phenomena & Standing Harmonics',
      deliveryMode: 'Online',
      status: 'Completed',
      paymentStatus: 'Paid',
      paidDate: addDaysISO(anchorToday, -12),
      paymentMethod: 'Bank Transfer',
      homeworkAssigned: '2023 May TZ2 Q4–Q6',
      nextLessonPlan: 'Doppler effect and thin-film interference proofs',
    },
    {
      id: 'les-2',
      studentId: 'stu-nadia',
      date: addDaysISO(anchorToday, -6),
      startTime: '16:00',
      plannedDurationMin: 60,
      actualDurationMin: 60,
      prepMinutes: 15,
      topic: 'Electromagnetic Induction & Lenz Law',
      deliveryMode: 'Online',
      status: 'Completed',
      paymentStatus: 'Invoiced',
      homeworkAssigned: 'Flux linkage worksheet #4',
      nextLessonPlan: 'AC generators and transformer efficiency',
    },
    {
      id: 'les-3',
      studentId: 'stu-liam',
      date: addDaysISO(anchorToday, -11),
      startTime: '17:30',
      plannedDurationMin: 60,
      actualDurationMin: 65,
      topic: 'Taylor Series & Lagrange Error Bound',
      deliveryMode: 'Hybrid',
      status: 'Completed',
      paymentStatus: 'Paid',
      paidDate: addDaysISO(anchorToday, -10),
      paymentMethod: 'Bank Transfer',
      homeworkAssigned: 'FRQ 2022 #6 + Alternating Series practice',
      nextLessonPlan: 'Parametric curves and arc length',
    },
    {
      id: 'les-4',
      studentId: 'stu-liam',
      date: addDaysISO(anchorToday, -4),
      startTime: '17:30',
      plannedDurationMin: 60,
      actualDurationMin: 60,
      topic: 'Polar Area & Tangent Slopes',
      deliveryMode: 'In-Person',
      status: 'Completed',
      paymentStatus: 'Unpaid',
      homeworkAssigned: 'Polar intersections packet',
      nextLessonPlan: 'Logistic differential equations',
    },
    {
      id: 'les-5',
      studentId: 'stu-liam',
      date: addDaysISO(anchorToday, -2),
      startTime: '14:00',
      plannedDurationMin: 60,
      actualDurationMin: 0,
      topic: 'Extra Integration Review (Late Cancel)',
      deliveryMode: 'Online',
      status: 'Cancelled — Billable/No-Show',
      paymentStatus: 'Unpaid',
      homeworkAssigned: 'Review partial fractions sheet',
      nextLessonPlan: 'Reschedule mock timed section',
    },
    // Tomasz retainer lessons across cycles
    {
      id: 'les-6',
      studentId: 'stu-tomasz',
      date: `${prevMonthKey}-18`,
      startTime: '18:00',
      plannedDurationMin: 90,
      actualDurationMin: 90,
      topic: 'Sight-reading & Secondary Dominants',
      deliveryMode: 'In-Person',
      status: 'Completed',
      paymentStatus: 'Covered by Retainer/Package',
      homeworkAssigned: 'Bach French Suite Allemande bars 1–16',
      nextLessonPlan: 'Voice leading in four-part chorales',
    },
    {
      id: 'les-7',
      studentId: 'stu-tomasz',
      date: addDaysISO(anchorToday, -10),
      startTime: '18:00',
      plannedDurationMin: 90,
      actualDurationMin: 90,
      topic: 'Chopin Ballade No. 1 — Exposition Voicing',
      deliveryMode: 'In-Person',
      status: 'Completed',
      paymentStatus: 'Covered by Retainer/Package',
      homeworkAssigned: 'Slow metronome hands-separate m.36–68',
      nextLessonPlan: 'Pedaling clarity in waltz transition',
    },
    {
      id: 'les-8',
      studentId: 'stu-tomasz',
      date: addDaysISO(anchorToday, -3),
      startTime: '18:00',
      plannedDurationMin: 90,
      actualDurationMin: 90,
      topic: 'Modulation & Presto Coda Fingerings',
      deliveryMode: 'In-Person',
      status: 'Completed',
      paymentStatus: 'Covered by Retainer/Package',
      homeworkAssigned: 'Memorize coda LH leaps',
      nextLessonPlan: 'Full run-through & rubato pacing',
    },
    // Priya 8 completed lessons from her 10-lesson package (2 remaining -> triggers low-credit warning!)
    ...Array.from({ length: 8 }, (_, idx) => ({
      id: `les-priya-${idx + 1}`,
      studentId: 'stu-priya',
      date: addDaysISO(anchorToday, -22 + idx * 3),
      startTime: '11:00',
      plannedDurationMin: 60,
      actualDurationMin: 60,
      topic: [
        'Sliding Window & Two Pointers',
        'Monotonic Stack Patterns',
        'Binary Search on Answer Space',
        'BFS / Shortest Path Grids',
        'Topological Sort & Cycle Detection',
        '1D & 2D Dynamic Programming',
        'Tree DP & Lowest Common Ancestor',
        'Mock Interview #1 — Graph + Heap',
      ][idx],
      deliveryMode: 'Online' as const,
      status: (idx === 6 && anchorToday.endsWith('99')
        ? 'Cancelled — Excused'
        : 'Completed') as Lesson['status'],
      paymentStatus: 'Covered by Retainer/Package' as const,
      homeworkAssigned: `LeetCode timed set #${idx + 1}`,
      nextLessonPlan: idx === 7 ? 'Trie & Union-Find timed mock' : 'Review edge cases',
    })),
    // One excused cancellation for Nadia
    {
      id: 'les-excused',
      studentId: 'stu-nadia',
      date: addDaysISO(anchorToday, -9),
      startTime: '16:00',
      plannedDurationMin: 60,
      actualDurationMin: 0,
      topic: 'Quantum & Nuclear Models',
      deliveryMode: 'Online',
      status: 'Cancelled — Excused',
      paymentStatus: 'Unpaid',
      homeworkAssigned: '',
      nextLessonPlan: 'Moved to next regular slot',
    },
    // Scheduled Today & Upcoming
    {
      id: 'les-today-1',
      studentId: 'stu-nadia',
      date: anchorToday,
      startTime: '16:00',
      plannedDurationMin: 75,
      actualDurationMin: 75,
      prepMinutes: 15,
      topic: 'Capacitors & AC Rectifier Circuits',
      deliveryMode: 'Online',
      status: 'Scheduled',
      paymentStatus: 'Unpaid',
      homeworkAssigned: 'Prepare oscilloscope trace questions',
      nextLessonPlan: 'Quantum & nuclear review',
    },
    {
      id: 'les-today-2',
      studentId: 'stu-priya',
      date: anchorToday,
      startTime: '19:00',
      plannedDurationMin: 60,
      actualDurationMin: 60,
      topic: 'Trie & Union-Find Timed Mock #2',
      deliveryMode: 'Online',
      status: 'Scheduled',
      paymentStatus: 'Covered by Retainer/Package',
      homeworkAssigned: 'Implement DSU with path compression',
      nextLessonPlan: 'Package renewal check-in + system design',
    },
    {
      id: 'les-upcoming-1',
      studentId: 'stu-tomasz',
      date: addDaysISO(anchorToday, 2),
      startTime: '18:00',
      plannedDurationMin: 90,
      actualDurationMin: 90,
      topic: 'Full Ballade No. 1 Performance Run',
      deliveryMode: 'In-Person',
      status: 'Scheduled',
      paymentStatus: 'Covered by Retainer/Package',
      homeworkAssigned: 'Warm up scales in G minor',
      nextLessonPlan: 'Harmonic analysis of Coda',
    },
    {
      id: 'les-upcoming-2',
      studentId: 'stu-liam',
      date: addDaysISO(anchorToday, 3),
      startTime: '17:30',
      plannedDurationMin: 60,
      actualDurationMin: 60,
      topic: 'AP Calc Mock FRQ Set B',
      deliveryMode: 'Hybrid',
      status: 'Scheduled',
      paymentStatus: 'Unpaid',
      homeworkAssigned: 'Bring formula sheet',
      nextLessonPlan: 'Timed MCQ section review',
    },
  ]

  const expenses: Expense[] = [
    {
      id: 'exp-1',
      date: addDaysISO(anchorToday, -12),
      title: 'IB Physics Past Paper Booklet Printing',
      category: 'Teaching Materials & Printing',
      amountMinor: 2450,
      isRecurringMonthly: false,
      paymentMethod: 'Card',
      notes: 'Bound 120-page Paper 2/3 compilation',
      studentId: 'stu-nadia',
    },
    {
      id: 'exp-2',
      date: addDaysISO(anchorToday, -8),
      title: 'Monthly Metro & Fuel Pass (In-Person Visits)',
      category: 'Transport/Fuel',
      amountMinor: 4800,
      isRecurringMonthly: true,
      paymentMethod: 'Card',
      notes: 'Commute for Tomasz & Liam in-person sessions',
      studentId: 'stu-tomasz',
    },
    {
      id: 'exp-3',
      date: addDaysISO(anchorToday, -5),
      title: 'Video Whiteboard & Cloud Recording Plan',
      category: 'Software & Tools',
      amountMinor: 1600,
      isRecurringMonthly: true,
      paymentMethod: 'Card',
      notes: 'Used for online physics & coding tutoring',
    },
    {
      id: 'exp-4',
      date: addDaysISO(anchorToday, -2),
      title: 'AP Calculus Practice Workbook Copy',
      category: 'Teaching Materials & Printing',
      amountMinor: 1990,
      isRecurringMonthly: false,
      paymentMethod: 'Cash',
      notes: 'Annotated reference copy for Liam',
      studentId: 'stu-liam',
    },
  ]

  const tasks = [
    {
      id: 'tsk-1',
      title: 'Annotate Capacitor & Rectifier Past Paper Pack',
      notes: 'Focus on phase lag diagrams for tonight’s IB Physics HL session.',
      status: 'In Progress' as const,
      priority: 'Urgent' as const,
      tags: ['prep', 'physics'],
      dueDate: anchorToday,
      dueTime: '14:30',
      estimatedMin: 35,
      subtasks: [
        { id: 'tsk-1-s1', title: 'Select 4 Paper 2 questions (2021–2024)', done: true },
        { id: 'tsk-1-s2', title: 'Write step-by-step markscheme notes', done: false },
        { id: 'tsk-1-s3', title: 'Upload PDF to shared folder', done: false },
      ],
      recurrence: { frequency: 'None' as const },
      studentId: 'stu-nadia',
      lessonId: 'les-today-1',
      createdAt: addDaysISO(anchorToday, -2),
    },
    {
      id: 'tsk-2',
      title: 'Send Priya 10-lesson package renewal note',
      notes: 'Only 2 credits remaining after previous mock session.',
      status: 'To Do' as const,
      priority: 'High' as const,
      tags: ['billing', 'admin'],
      dueDate: anchorToday,
      dueTime: '20:15',
      estimatedMin: 10,
      subtasks: [],
      recurrence: { frequency: 'None' as const },
      studentId: 'stu-priya',
      lessonId: 'les-today-2',
      createdAt: addDaysISO(anchorToday, -1),
    },
    {
      id: 'tsk-3',
      title: 'Follow up on Liam overdue tuition statement',
      notes: 'Covers Polar Area lesson and late-cancelled review slot.',
      status: 'To Do' as const,
      priority: 'High' as const,
      tags: ['billing'],
      dueDate: addDaysISO(anchorToday, -1),
      estimatedMin: 10,
      subtasks: [
        { id: 'tsk-3-s1', title: 'Export printable statement for O’Connor family', done: false },
      ],
      recurrence: { frequency: 'None' as const },
      studentId: 'stu-liam',
      createdAt: addDaysISO(anchorToday, -3),
    },
    {
      id: 'tsk-4',
      title: 'Weekly studio bookkeeping & backup JSON export',
      notes: 'Reconcile paid transfers, log receipts, save local JSON snapshot.',
      status: 'To Do' as const,
      priority: 'Medium' as const,
      tags: ['finance', 'routine'],
      dueDate: addDaysISO(anchorToday, 2),
      estimatedMin: 20,
      subtasks: [
        { id: 'tsk-4-s1', title: 'Verify bank transfer settlements', done: false },
        { id: 'tsk-4-s2', title: 'Download JSON backup', done: false },
      ],
      recurrence: { frequency: 'Weekly' as const, weekDays: [5] },
      createdAt: addDaysISO(anchorToday, -7),
    },
    {
      id: 'tsk-5',
      title: 'Order replacement stylus nibs & acoustic metronome battery',
      notes: 'Check local stationery shop before Friday.',
      status: 'Inbox' as const,
      priority: 'Low' as const,
      tags: ['studio'],
      subtasks: [],
      recurrence: { frequency: 'None' as const },
      createdAt: anchorToday,
    },
    {
      id: 'tsk-6',
      title: 'Mark Chopin Ballade score breath marks',
      notes: 'Highlight voicing transitions between m.36 and m.68.',
      status: 'Waiting' as const,
      priority: 'Medium' as const,
      tags: ['prep', 'piano'],
      dueDate: addDaysISO(anchorToday, 1),
      estimatedMin: 25,
      subtasks: [],
      recurrence: { frequency: 'None' as const },
      studentId: 'stu-tomasz',
      lessonId: 'les-upcoming-1',
      createdAt: addDaysISO(anchorToday, -2),
    },
  ]

  return {
    schemaVersion: 1,
    demoLoaded: true,
    settings,
    students,
    lessons,
    retainerPayments,
    expenses,
    tasks,
    timer: {
      running: false,
      startedAtMs: null,
      accumulatedMs: 0,
    },
  }
}

export function loadLedgerState(): LedgerState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDemoLedgerState()
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return createDemoLedgerState()
  }
  const parsed = validateImportPayload(raw)
  if (parsed.ok) return parsed.state
  // Preserve corrupted payload so user data is never silently lost.
  try {
    window.localStorage.setItem(CORRUPT_BACKUP_KEY, raw)
  } catch {
    // ignore storage quota errors on backup
  }
  return createEmptyLedgerState()
}

export function saveLedgerState(state: LedgerState): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota error; IndexedDB holds full capacity beyond 5 MB
  }
}

function openLedgerDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = window.indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

export async function loadIndexedDBState(): Promise<LedgerState | null> {
  try {
    const db = await openLedgerDB()
    return await new Promise<LedgerState | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => {
        db.close()
        const raw = req.result
        if (!raw) {
          resolve(null)
          return
        }
        const check =
          typeof raw === 'string'
            ? validateImportPayload(raw)
            : validateImportPayload(JSON.stringify(raw))
        resolve(check.ok ? check.state : null)
      }
      req.onerror = () => {
        db.close()
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

export async function saveIndexedDBState(state: LedgerState): Promise<void> {
  try {
    const db = await openLedgerDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(state, IDB_KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error)
      }
    })
  } catch {
    // ignore IDB write error in restricted private modes
  }
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      await navigator.storage.persist()
    }
  } catch {
    // non-fatal
  }
}

export function validateImportPayload(
  rawJson: string,
): { ok: true; state: LedgerState } | { ok: false; error: string } {
  let data: unknown
  try {
    data = JSON.parse(rawJson)
  } catch {
    return { ok: false, error: 'Invalid JSON syntax.' }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'Backup root must be a JSON object.' }
  }
  const obj = data as Record<string, unknown>
  if (obj.schemaVersion !== 1) {
    return { ok: false, error: `Unsupported schema version: ${String(obj.schemaVersion)}` }
  }
  if (!obj.settings || typeof obj.settings !== 'object') {
    return { ok: false, error: 'Missing workspace settings object.' }
  }
  const settings = obj.settings as Record<string, unknown>
  if (
    typeof settings.currency !== 'string' ||
    !Number.isInteger(settings.defaultHourlyRateMinor) ||
    !Number.isInteger(settings.defaultLessonDurationMin)
  ) {
    return { ok: false, error: 'Invalid settings currency or integer minor units.' }
  }
  if (
    !Array.isArray(obj.students) ||
    !Array.isArray(obj.lessons) ||
    !Array.isArray(obj.expenses) ||
    !Array.isArray(obj.tasks)
  ) {
    return { ok: false, error: 'Backup must include students, lessons, expenses, and tasks arrays.' }
  }

  for (const s of obj.students) {
    if (!s || typeof s !== 'object' || typeof (s as Student).id !== 'string' || typeof (s as Student).name !== 'string') {
      return { ok: false, error: 'Invalid student record in backup.' }
    }
  }
  for (const l of obj.lessons) {
    if (
      !l ||
      typeof l !== 'object' ||
      typeof (l as Lesson).id !== 'string' ||
      typeof (l as Lesson).studentId !== 'string' ||
      typeof (l as Lesson).date !== 'string'
    ) {
      return { ok: false, error: 'Invalid lesson record in backup.' }
    }
  }
  for (const e of obj.expenses) {
    if (
      !e ||
      typeof e !== 'object' ||
      typeof (e as Expense).id !== 'string' ||
      !Number.isInteger((e as Expense).amountMinor)
    ) {
      return { ok: false, error: 'Invalid expense record (amountMinor must be integer).' }
    }
  }

  const normalized: LedgerState = {
    schemaVersion: 1,
    demoLoaded: Boolean(obj.demoLoaded),
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined,
    settings: {
      currency: settings.currency,
      defaultHourlyRateMinor: settings.defaultHourlyRateMinor as number,
      defaultLessonDurationMin: settings.defaultLessonDurationMin as number,
      workingHoursStart:
        typeof settings.workingHoursStart === 'string' ? settings.workingHoursStart : '09:00',
      workingHoursEnd:
        typeof settings.workingHoursEnd === 'string' ? settings.workingHoursEnd : '19:00',
      theme: settings.theme === 'ink' ? 'ink' : 'paper',
    },
    students: obj.students as Student[],
    lessons: obj.lessons as Lesson[],
    retainerPayments: Array.isArray(obj.retainerPayments)
      ? (obj.retainerPayments as LedgerState['retainerPayments'])
      : [],
    expenses: obj.expenses as Expense[],
    tasks: obj.tasks as LedgerState['tasks'],
    timer:
      obj.timer && typeof obj.timer === 'object'
        ? (obj.timer as LedgerState['timer'])
        : { running: false, startedAtMs: null, accumulatedMs: 0 },
  }
  return { ok: true, state: normalized }
}

function escapeCSVField(value: string | number | boolean | undefined): string {
  const str = value === undefined ? '' : String(value)
  // Prefix spreadsheet formula triggers to avoid CSV injection on Excel/Calc.
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportLessonsCSV(
  lessons: Lesson[],
  students: Student[],
  settings: WorkspaceSettings,
  resolveCharge: (lesson: Lesson, student?: Student) => number,
): string {
  const studentMap = new Map(students.map((s) => [s.id, s]))
  const header = [
    'Date',
    'Start Time',
    'Student',
    'Subject',
    'Topic',
    'Delivery Mode',
    'Status',
    'Planned Min',
    'Actual Min',
    'Amount',
    'Payment Status',
    'Paid Date',
    'Payment Method',
  ].join(',')
  const rows = lessons
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((l) => {
      const s = studentMap.get(l.studentId)
      const minor = resolveCharge(l, s)
      return [
        l.date,
        l.startTime,
        s?.name ?? 'Unknown',
        s?.subject ?? '',
        l.topic,
        l.deliveryMode,
        l.status,
        l.plannedDurationMin,
        l.actualDurationMin,
        formatMoney(minor, settings.currency),
        l.paymentStatus,
        l.paidDate ?? '',
        l.paymentMethod ?? '',
      ]
        .map(escapeCSVField)
        .join(',')
    })
  return [header, ...rows].join('\n')
}

export function exportExpensesCSV(
  expenses: Expense[],
  students: Student[],
  settings: WorkspaceSettings,
): string {
  const studentMap = new Map(students.map((s) => [s.id, s]))
  const header = [
    'Date',
    'Title',
    'Category',
    'Amount',
    'Recurring Monthly',
    'Payment Method',
    'Linked Student',
    'Notes',
  ].join(',')
  const rows = expenses
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => {
      const s = e.studentId ? studentMap.get(e.studentId) : undefined
      return [
        e.date,
        e.title,
        e.category,
        formatMoney(e.amountMinor, settings.currency),
        e.isRecurringMonthly ? 'Yes' : 'No',
        e.paymentMethod,
        s?.name ?? '',
        e.notes,
      ]
        .map(escapeCSVField)
        .join(',')
    })
  return [header, ...rows].join('\n')
}
