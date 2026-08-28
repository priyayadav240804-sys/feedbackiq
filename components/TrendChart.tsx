'use client'

import { useState, useEffect, useRef } from 'react'

interface DayData {
  date: string
  total: number
  Positive: number
  Neutral: number
  Negative: number
}

interface TrendsData {
  hasDateData: boolean
  daily?: DayData[]
  totalWithDate?: number
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  data: DayData | null
}

const CHART_HEIGHT  = 180
const CHART_PADDING = { top: 16, bottom: 32, left: 40, right: 16 }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function TrendChart() {
  const [data, setData] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, data: null })
  const svgRef = useRef<SVGSVGElement>(null)
  const [chartWidth, setChartWidth] = useState(600)

  useEffect(() => {
    fetch('/api/trends')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ hasDateData: false }))
      .finally(() => setLoading(false))
  }, [])

  // Measure actual container width
  useEffect(() => {
    if (!svgRef.current) return
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setChartWidth(w)
    })
    obs.observe(svgRef.current.parentElement!)
    return () => obs.disconnect()
  }, [data])

  if (loading) {
    return <div className="skeleton" style={{ height: CHART_HEIGHT + CHART_PADDING.top + CHART_PADDING.bottom, borderRadius: 'var(--radius-md)' }} />
  }

  if (!data?.hasDateData || !data.daily || data.daily.length === 0) {
    return (
      <div style={{
        height: CHART_HEIGHT + CHART_PADDING.top + CHART_PADDING.bottom,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No date data available</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Add a &quot;date&quot; column to your CSV to see trends</div>
      </div>
    )
  }

  const daily = data.daily
  const maxVal = Math.max(...daily.map((d) => d.total), 1)

  // Drawing area dimensions
  const drawW = chartWidth - CHART_PADDING.left - CHART_PADDING.right
  const drawH = CHART_HEIGHT

  const xPos = (i: number) => CHART_PADDING.left + (i / Math.max(daily.length - 1, 1)) * drawW
  const yPos = (val: number) => CHART_PADDING.top + drawH - (val / maxVal) * drawH

  // Smooth polyline path
  const totalPoints = daily.map((d, i) => `${xPos(i)},${yPos(d.total)}`).join(' ')

  // Ticks
  const maxTick = Math.ceil(maxVal / 5) * 5 || 5
  const yTicks = [0, Math.round(maxTick / 2), maxTick]

  // Label every Nth day so they don't overlap
  const labelEvery = Math.ceil(daily.length / 7)

  const totalSvgH = CHART_HEIGHT + CHART_PADDING.top + CHART_PADDING.bottom

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        width="100%"
        height={totalSvgH}
        viewBox={`0 0 ${chartWidth} ${totalSvgH}`}
        preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={CHART_PADDING.left} x2={chartWidth - CHART_PADDING.right}
              y1={yPos(tick)}          y2={yPos(tick)}
              stroke="var(--border-subtle)" strokeWidth={1} strokeDasharray="4 4"
            />
            <text
              x={CHART_PADDING.left - 6} y={yPos(tick) + 4}
              textAnchor="end" fontSize={10} fill="var(--text-muted)"
            >
              {tick}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <defs>
          <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--brand-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon
          points={[
            `${CHART_PADDING.left},${CHART_PADDING.top + CHART_HEIGHT}`,
            ...daily.map((d, i) => `${xPos(i)},${yPos(d.total)}`),
            `${xPos(daily.length - 1)},${CHART_PADDING.top + CHART_HEIGHT}`,
          ].join(' ')}
          fill="url(#trend-grad)"
        />

        {/* Line */}
        <polyline
          points={totalPoints}
          fill="none"
          stroke="var(--brand-primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points + hover zones */}
        {daily.map((d, i) => (
          <g key={d.date}>
            {/* Invisible wide hit area */}
            <rect
              x={xPos(i) - 12} y={CHART_PADDING.top}
              width={24}        height={CHART_HEIGHT}
              fill="transparent"
              onMouseEnter={(e) => {
                const svgEl = svgRef.current
                if (!svgEl) return
                const rect = svgEl.getBoundingClientRect()
                setTooltip({
                  visible: true,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top - 8,
                  data: d,
                })
              }}
              onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
              style={{ cursor: 'crosshair' }}
            />
            {/* Dot */}
            <circle
              cx={xPos(i)} cy={yPos(d.total)}
              r={d.total > 0 ? 3.5 : 0}
              fill="var(--brand-primary)" stroke="var(--bg-surface)" strokeWidth={2}
            />
            {/* X-axis label */}
            {i % labelEvery === 0 && (
              <text
                x={xPos(i)} y={totalSvgH - 6}
                textAnchor="middle" fontSize={10} fill="var(--text-muted)"
              >
                {formatDate(d.date)}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip.visible && tooltip.data && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 12,
          top:  tooltip.y,
          background: 'var(--bg-active)',
          border: '1px solid var(--border-bright)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          fontSize: 12,
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: 'var(--shadow-md)',
          minWidth: 130,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>
            {formatDate(tooltip.data.date)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
            <span style={{ color: 'var(--text-muted)' }}>Total</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tooltip.data.total}</span>
          </div>
          {tooltip.data.Negative > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
              <span style={{ color: 'var(--negative)' }}>😞 Negative</span>
              <span style={{ color: 'var(--negative)', fontWeight: 600 }}>{tooltip.data.Negative}</span>
            </div>
          )}
          {tooltip.data.Neutral > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
              <span style={{ color: 'var(--neutral)' }}>😐 Neutral</span>
              <span style={{ color: 'var(--neutral)', fontWeight: 600 }}>{tooltip.data.Neutral}</span>
            </div>
          )}
          {tooltip.data.Positive > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--positive)' }}>😊 Positive</span>
              <span style={{ color: 'var(--positive)', fontWeight: 600 }}>{tooltip.data.Positive}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
