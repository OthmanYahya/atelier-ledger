import { useState } from 'react'
import type { BillingModelBreakdown, MonthlyComparisonPoint } from '../domain/analytics'
import { formatMoney } from '../domain/money'

export function MonthlyComparisonChart({
  series,
  currency,
}: {
  series: MonthlyComparisonPoint[]
  currency: string
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const width = 620
  const height = 220
  const padL = 66
  const padR = 16
  const padT = 18
  const padB = 34
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  const maxVal = Math.max(
    100,
    ...series.flatMap((d) => [d.revenueMinor, d.expensesMinor, Math.max(0, d.netProfitMinor)]),
  )
  const minVal = Math.min(0, ...series.map((d) => d.netProfitMinor))
  const span = Math.max(1, maxVal - minVal)

  const yFor = (val: number) => padT + ((maxVal - val) / span) * plotH
  const zeroY = yFor(0)
  const stepW = plotW / Math.max(1, series.length)
  const barW = Math.min(20, stepW * 0.28)

  const netPoints = series
    .map((pt, idx) => {
      const cx = padL + idx * stepW + stepW / 2
      const cy = yFor(pt.netProfitMinor)
      return `${cx},${cy}`
    })
    .join(' ')

  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : series[series.length - 1]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: 'var(--accent)' }} />
            <span style={{ color: 'var(--ink-secondary)' }}>Earned</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: 'var(--terracotta)' }} />
            <span style={{ color: 'var(--ink-secondary)' }}>Expenses</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3.5" style={{ backgroundColor: 'var(--ink-primary)' }} />
            <span style={{ color: 'var(--ink-secondary)' }}>Net Profit</span>
          </span>
        </div>

        {activePoint && (
          <div className="tabular-nums flex items-center gap-3 text-[12px]">
            <span className="font-semibold">{activePoint.label}:</span>
            <span style={{ color: 'var(--accent)' }}>
              Rev {formatMoney(activePoint.revenueMinor, currency)}
            </span>
            <span style={{ color: 'var(--terracotta)' }}>
              Exp {formatMoney(activePoint.expensesMinor, currency)}
            </span>
            <span className="font-semibold">
              Net {formatMoney(activePoint.netProfitMinor, currency)}
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="6-month revenue, expenses, and net profit chart"
      >
        {[0, 0.5, 1].map((frac) => {
          const val = Math.round(minVal + span * frac)
          const y = yFor(val)
          return (
            <g key={frac}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray={val === 0 ? undefined : '3 3'}
                strokeWidth={val === 0 ? 1.2 : 1}
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--ink-muted)"
                className="tabular-nums"
              >
                {formatMoney(val, currency).replace(/\.00$/, '')}
              </text>
            </g>
          )
        })}

        {series.map((pt, idx) => {
          const cx = padL + idx * stepW + stepW / 2
          const revTop = yFor(pt.revenueMinor)
          const expTop = yFor(pt.expensesMinor)
          const isHovered = hoveredIdx === idx
          return (
            <g
              key={pt.monthKey}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={padL + idx * stepW}
                y={padT}
                width={stepW}
                height={plotH}
                fill={isHovered ? 'var(--bg-subtle)' : 'transparent'}
                opacity={0.45}
                rx={4}
              />
              <rect
                x={cx - barW - 2}
                y={revTop}
                width={barW}
                height={Math.max(2, zeroY - revTop)}
                fill="var(--accent)"
                rx={2}
              />
              <rect
                x={cx + 2}
                y={expTop}
                width={barW}
                height={Math.max(2, zeroY - expTop)}
                fill="var(--terracotta)"
                rx={2}
              />
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight={isHovered ? '600' : '500'}
                fill={isHovered ? 'var(--ink-primary)' : 'var(--ink-secondary)'}
              >
                {pt.label}
              </text>
            </g>
          )
        })}

        <polyline
          fill="none"
          stroke="var(--ink-primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={netPoints}
        />

        {series.map((pt, idx) => {
          const cx = padL + idx * stepW + stepW / 2
          const cy = yFor(pt.netProfitMinor)
          return (
            <circle
              key={`dot-${pt.monthKey}`}
              cx={cx}
              cy={cy}
              r={hoveredIdx === idx ? 4.5 : 3}
              fill="var(--bg-surface)"
              stroke="var(--ink-primary)"
              strokeWidth={2}
            />
          )
        })}
      </svg>
    </div>
  )
}

export function BillingModelComparisonBars({
  rows,
  currency,
}: {
  rows: BillingModelBreakdown[]
  currency: string
}) {
  const maxRev = Math.max(1, ...rows.map((r) => r.revenueMinor))
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = Math.round((row.revenueMinor / maxRev) * 100)
        return (
          <div key={row.type} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-medium">{row.label}</span>
              <span className="tabular-nums text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                <strong style={{ color: 'var(--ink-primary)' }}>
                  {formatMoney(row.revenueMinor, currency)}
                </strong>
                {' · '}
                {row.hoursTaught.toFixed(1)}h
                {' · '}
                {formatMoney(row.effectiveHourlyRateMinor, currency)}/hr
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${row.revenueMinor > 0 ? Math.max(3, pct) : 0}%`,
                  backgroundColor:
                    row.type === 'retainer'
                      ? 'var(--accent)'
                      : row.type === 'package'
                        ? 'var(--sage)'
                        : row.type === 'flat'
                          ? 'var(--ochre)'
                          : 'var(--terracotta)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
