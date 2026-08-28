'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ProblemGroup {
  id: string
  title: string
  summary: string | null
  sentiment: string | null
  feedbackCount: number
  createdAt: string
}

interface ApiResponse {
  problems: ProblemGroup[]
  total: number
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

export default function ProblemsPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sentiment, setSentiment] = useState('')

  const fetchProblems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (search)    params.set('search',    search)
      if (sentiment) params.set('sentiment', sentiment)

      const res  = await fetch(`/api/problems?${params}`)
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [search, sentiment])

  useEffect(() => { fetchProblems() }, [fetchProblems])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const hasProblems = data && data.total > 0

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Customer Problems</div>
          <div className="topbar-subtitle">
            {data ? `${data.total} problem${data.total !== 1 ? 's' : ''} identified by AI` : 'Loading…'}
          </div>
        </div>
      </div>

      <div className="page-content fade-in">

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <form onSubmit={handleSearch} style={{ flex: '1 1 280px' }}>
            <div className="search-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                placeholder="Search problems…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                id="problems-search-input"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(''); setSearch('') }} style={{ color: 'var(--text-muted)', fontSize: 16 }}>×</button>
              )}
            </div>
          </form>

          <select
            className="form-select"
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value)}
            id="problems-sentiment-filter"
            style={{ width: 160, flexShrink: 0 }}
          >
            <option value="">All sentiments</option>
            <option value="Negative">😞 Negative</option>
            <option value="Neutral">😐 Neutral</option>
            <option value="Positive">😊 Positive</option>
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        ) : !hasProblems ? (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <div className="empty-title">
              {search || sentiment ? 'No matching problems' : 'No problems identified yet'}
            </div>
            <div className="empty-body">
              {search || sentiment
                ? 'Try adjusting your filters.'
                : 'Upload customer feedback and run AI analysis from the Dashboard to automatically identify and group customer problems.'}
            </div>
            {!search && !sentiment && (
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href="/upload"    className="btn btn-primary">Upload Feedback</Link>
                <Link href="/dashboard" className="btn btn-secondary">Go to Dashboard</Link>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data!.problems.map((problem, index) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.id}`}
                id={`problem-card-${problem.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="card"
                  style={{ cursor: 'pointer', transition: 'all 0.18s ease' }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--border-bright)'
                    el.style.transform = 'translateY(-1px)'
                    el.style.boxShadow = 'var(--shadow-md)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--border-subtle)'
                    el.style.transform = 'none'
                    el.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    {/* Rank badge */}
                    <div style={{
                      width: 36, height: 36, flexShrink: 0,
                      background: index === 0 ? 'rgba(239,68,68,0.15)' : index === 1 ? 'rgba(245,158,11,0.12)' : index === 2 ? 'rgba(99,102,241,0.12)' : 'var(--bg-elevated)',
                      border: `1px solid ${index === 0 ? 'rgba(239,68,68,0.3)' : index === 1 ? 'rgba(245,158,11,0.2)' : index === 2 ? 'rgba(99,102,241,0.25)' : 'var(--border-muted)'}`,
                      borderRadius: 'var(--radius-md)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800,
                      color: index === 0 ? 'var(--negative)' : index === 1 ? 'var(--neutral)' : index === 2 ? 'var(--brand-light)' : 'var(--text-muted)',
                      marginTop: 2,
                    }}>
                      {index + 1}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
                          {problem.title}
                        </div>
                        {problem.sentiment && (
                          <span className={`badge ${sentimentBadge[problem.sentiment] || 'badge-muted'}`}>
                            {sentimentIcon[problem.sentiment]} {problem.sentiment}
                          </span>
                        )}
                      </div>

                      {problem.summary && (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
                          {problem.summary}
                        </div>
                      )}

                      {/* Impact bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, (problem.feedbackCount / (data!.problems[0]?.feedbackCount || 1)) * 100)}%`,
                            background: index === 0 ? 'var(--negative)' : index < 3 ? 'var(--neutral)' : 'var(--brand-primary)',
                            borderRadius: 99,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                          {problem.feedbackCount} report{problem.feedbackCount !== 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--brand-light)', flexShrink: 0 }}>
                          View evidence →
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
