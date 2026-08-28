'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface FeedbackItem {
  id: string
  feedbackText: string
  sentiment: string | null
  category: string | null
  date: string | null
  source: string | null
  platform: string | null
  userId: string | null
  batch: { name: string }
}

interface ProblemDetail {
  problem: {
    id: string
    title: string
    summary: string | null
    sentiment: string | null
    feedbackCount: number
    createdAt: string
  }
  feedbackItems: FeedbackItem[]
  sentimentBreakdown: Record<string, number>
  sourceBreakdown: Record<string, number>
}

const sentimentBadge: Record<string, string> = {
  Positive: 'badge-positive',
  Neutral:  'badge-neutral',
  Negative: 'badge-negative',
}

const sentimentIcon: Record<string, string> = {
  Positive: '😊',
  Neutral:  '😐',
  Negative: '😞',
}

const sentimentColor: Record<string, string> = {
  Positive: 'var(--positive)',
  Neutral:  'var(--neutral)',
  Negative: 'var(--negative)',
}

function QuoteCard({ item }: { item: FeedbackItem }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = item.feedbackText.length > 200

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        transition: 'all 0.18s ease',
        borderLeft: `3px solid ${item.sentiment ? sentimentColor[item.sentiment] || 'var(--border-muted)' : 'var(--border-muted)'}`,
      }}
    >
      {/* Quote text */}
      <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 10 }}>
        &ldquo;{isLong && !expanded ? item.feedbackText.slice(0, 200) + '…' : item.feedbackText}&rdquo;
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ marginLeft: 6, fontSize: 11, color: 'var(--brand-light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {item.sentiment && (
          <span className={`badge ${sentimentBadge[item.sentiment] || 'badge-muted'}`} style={{ fontSize: 10 }}>
            {sentimentIcon[item.sentiment]} {item.sentiment}
          </span>
        )}
        {item.category && (
          <span className="badge badge-brand" style={{ fontSize: 10 }}>{item.category}</span>
        )}
        {item.source && (
          <span className="badge badge-muted" style={{ fontSize: 10 }}>📍 {item.source}</span>
        )}
        {item.platform && (
          <span className="badge badge-muted" style={{ fontSize: 10 }}>📱 {item.platform}</span>
        )}
        {item.date && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
}

export default function ProblemDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [data, setData] = useState<ProblemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  useEffect(() => {
    if (!id) return
    const fetchDetail = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/problems/${id}`)
        if (!res.ok) throw new Error('Not found')
        const json = await res.json()
        setData(json)
      } catch {
        setError('Could not load problem details.')
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [id])

  const filteredItems = data?.feedbackItems.filter((item) => {
    if (sentimentFilter && item.sentiment !== sentimentFilter) return false
    if (sourceFilter    && item.source    !== sourceFilter)    return false
    return true
  }) ?? []

  const sources = data ? Object.keys(data.sourceBreakdown) : []
  const { problem } = data ?? {}

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/problems" className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <div className="topbar-title" style={{ maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {loading ? 'Loading…' : problem?.title || 'Problem Detail'}
            </div>
            <div className="topbar-subtitle">Evidence trail — customer quotes supporting this problem</div>
          </div>
        </div>
      </div>

      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : error ? (
          <div className="alert alert-error">
            {error}
            <Link href="/problems" style={{ marginLeft: 12, textDecoration: 'underline' }}>← Back to Problems</Link>
          </div>
        ) : data && problem ? (
          <>
            {/* ── Problem Summary Card ── */}
            <div className="card" style={{ marginBottom: 24, borderLeft: `4px solid ${problem.sentiment ? sentimentColor[problem.sentiment] || 'var(--border-muted)' : 'var(--border-muted)'}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: 8, lineHeight: 1.3 }}>
                    {problem.title}
                  </div>
                  {problem.summary && (
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {problem.summary}
                    </div>
                  )}
                </div>
                {problem.sentiment && (
                  <span className={`badge ${sentimentBadge[problem.sentiment]}`} style={{ fontSize: 13, padding: '5px 12px', flexShrink: 0 }}>
                    {sentimentIcon[problem.sentiment]} {problem.sentiment}
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>Reports</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{problem.feedbackCount}</div>
                </div>
                {Object.entries(data.sentimentBreakdown).map(([s, count]) => (
                  <div key={s}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{s}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: sentimentColor[s] || 'var(--text-primary)', lineHeight: 1 }}>{count}</div>
                  </div>
                ))}
                {Object.entries(data.sourceBreakdown).slice(0, 3).map(([src, count]) => (
                  <div key={src}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{src}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Evidence Filter Bar ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>
                📋 {filteredItems.length} quote{filteredItems.length !== 1 ? 's' : ''}
              </div>

              <select
                className="form-select"
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                id="detail-sentiment-filter"
                style={{ width: 150 }}
              >
                <option value="">All sentiments</option>
                <option value="Negative">😞 Negative</option>
                <option value="Neutral">😐 Neutral</option>
                <option value="Positive">😊 Positive</option>
              </select>

              {sources.length > 1 && (
                <select
                  className="form-select"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  id="detail-source-filter"
                  style={{ width: 160 }}
                >
                  <option value="">All sources</option>
                  {sources.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}

              {(sentimentFilter || sourceFilter) && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setSentimentFilter(''); setSourceFilter('') }}>
                  Clear filters
                </button>
              )}
            </div>

            {/* ── Evidence / Quotes ── */}
            {filteredItems.length === 0 ? (
              <div className="empty-state" style={{ paddingTop: 32 }}>
                <div className="empty-icon">🔍</div>
                <div className="empty-title">No quotes match your filters</div>
                <button className="btn btn-secondary" onClick={() => { setSentimentFilter(''); setSourceFilter('') }}>Clear filters</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredItems.map((item) => (
                  <QuoteCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  )
}
