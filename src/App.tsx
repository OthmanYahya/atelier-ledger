import { useState } from 'react'
import { CommandPalette } from './components/CommandPalette'
import { ExpenseDrawer } from './components/ExpenseDrawer'
import { LessonDrawer } from './components/LessonDrawer'
import { Sidebar } from './components/Sidebar'
import { StatementModal } from './components/StatementModal'
import { StudentDrawer } from './components/StudentDrawer'
import { TaskDrawer } from './components/TaskDrawer'
import { LedgerProvider, useLedger } from './context/LedgerContext'
import { FinancesView } from './views/FinancesView'
import { LessonsCalendarView } from './views/LessonsCalendarView'
import { OverviewView } from './views/OverviewView'
import { SettingsView } from './views/SettingsView'
import { StudentsView } from './views/StudentsView'
import { TasksView } from './views/TasksView'

function WorkspaceShell() {
  const { activeNav } = useLedger()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenMobile={() => setMobileMenuOpen(true)}
      />

      <main className="no-print min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          {activeNav === 'overview' && <OverviewView />}
          {activeNav === 'tasks' && <TasksView />}
          {activeNav === 'lessons' && <LessonsCalendarView />}
          {activeNav === 'students' && <StudentsView />}
          {activeNav === 'finances' && <FinancesView />}
          {activeNav === 'settings' && <SettingsView />}
        </div>
      </main>

      <TaskDrawer />
      <LessonDrawer />
      <StudentDrawer />
      <ExpenseDrawer />
      <StatementModal />
      <CommandPalette />
    </div>
  )
}

export default function App() {
  return (
    <LedgerProvider>
      <WorkspaceShell />
    </LedgerProvider>
  )
}
