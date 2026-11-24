import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="no-print fixed inset-0 z-40 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="fixed inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`relative z-10 flex h-full w-full flex-col border-l ${
          wide ? 'max-w-2xl' : 'max-w-xl'
        }`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        <header
          className="flex items-start justify-between gap-4 border-b px-6 py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-md p-1.5 transition-colors hover:opacity-80"
            style={{ color: 'var(--ink-secondary)', backgroundColor: 'var(--bg-subtle)' }}
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer
            className="flex items-center justify-between gap-3 border-t px-6 py-3.5"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
          >
            {footer}
          </footer>
        )}
      </aside>
    </div>
  )
}
