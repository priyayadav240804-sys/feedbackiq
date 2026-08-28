'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface FeedbackItem {
  id: string
  feedbackText: string
  date: string | null
  source: string | null
  platform: string | null
  isValid: boolean
  invalidReason: string | null
  sentiment: string | null
  category: string | null
  createdAt: string
  batch: { name: string }
}

interface ApiResponse {
  items: FeedbackItem[]
  total: number
  page: number
  limit: number
}

const PAGE_SIZE = 25

const sentimentBadge = (s: string | null) => {
  if (!s) return <span className="badge badge-muted">—</span>
  if (s === 'Positive') return <span className="badge badge-positive">😊 Positive</span>
  if (s === 'Negative') return <span className="badge badge-negative">😞 Negative</span>
  return <span className="badge badge-neutral">😐 Neutral</span>
}

export default function FeedbackPage() {
  const [data, setData]               = useState<ApiResponse | null>(null)
  const [page, setPage]               = useState(1)
  const [search, setSearch]           = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [showInvalid, setShowInvalid] = useState(false)

  // Filters
  const [sentiment, setSentiment]   = useState('')
  const [category, setCategory]     = useState('')
  const [source, setSource]         = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [sources, setSources]       = useState<string[]>([])

  // Load filter options once
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => {
        if (d.categories) setCategories(d.categories)
        if (d.sources)    setSources(d.sources)
      })
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(PAGE_SIZE),
      })
      if (search)       params.set('search',    search)
      if (!showInvalid) params.set('isValid',   'true')
      if (sentiment)    params.set('sentiment', sentiment)
      if (category)     params.set('category',  category)
      if (source)       params.set('source',    source)

      const res = await fetch(`/api/feedback?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Failed to load feedback. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [page, search, showInvalid, sentiment, category, source])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  const clearAllFilters = () => {
    setSearch('')
    setSearchInput('')
    setSentiment('')
    setCategory('')
    setSource('')
    setShowInvalid(false)
    setPage(1)
  }

  const hasActiveFilters = search || sentiment || category || source || showInvalid
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div>
          <div className="topbar-title">All Feedback</div>
          <div className="topbar-subtitle">
            {data ? `${data.total.toLocaleString()} item${data.total !== 1 ? 's' : ''}` : 'Loading…'}
          </div>
        </div>
        <div className="topbar-actions">
          <Link href="/upload" className="btn btn-primary btn-sm">+ Upload More</Link>
        </div>
      </div>

      <div className="page-content fade-in">
        {/* Filters bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <form onSubmit={handleSearch} style={{ flex: '1 1 260px' }}>
            <div className="search-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                placeholder="Search feedback text…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                id="feedback-search-input"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }} style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}>×</button>
              )}
            </div>
          </form>

          {/* Sentiment filter */}
          <select
            className="form-select"
            value={sentiment}
            onChange={(e) => { setSentiment(e.target.value); setPage(1) }}
            id="feedback-sentiment-filter"
            style={{ width: 148, flexShrink: 0 }}
          >
            <option value="">All sentiments</option>
            <option value="Negative">😞 Negative</option>
            <option value="Neutral">😐 Neutral</option>
            <option value="Positive">😊 Positive</option>
          </select>

          {/* Category filter */}
          {categories.length > 0 && (
            <select
              className="form-select"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1) }}
              id="feedback-category-filter"
              style={{ width: 180, flexShrink: 0 }}
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c!}>{c}</option>)}
            </select>
          )}

          {/* Source filter */}
          {sources.length > 0 && (
            <select
              className="form-select"
              value={source}
              onChange={(e) => { setSource(e.target.value); setPage(1) }}
              id="feedback-source-filter"
              style={{ width: 148, flexShrink: 0 }}
            >
              <option value="">All sources</option>
              {sources.map((s) => <option key={s} value={s!}>{s}</option>)}
            </select>
          )}

          {/* Show invalid toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={showInvalid}
              onChange={(e) => { setShowInvalid(e.target.checked); setPage(1) }}
              id="show-invalid-checkbox"
              style={{ accentColor: 'var(--brand-primary)', width: 14, height: 14 }}
            />
            Show invalid
          </label>

          {/* Clear all */}
          {hasActiveFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearAllFilters} style={{ flexShrink: 0 }}>
              ✕ Clear all
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : !data || data.items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-title">{hasActiveFilters ? 'No results match your filters' : 'No feedback yet'}</div>
            <div className="empty-body">
              {hasActiveFilters
                ? 'Try adjusting or clearing your filters.'
                : 'Upload a CSV file to start analyzing customer feedback.'}
            </div>
            {hasActiveFilters
              ? <button className="btn btn-secondary" onClick={clearAllFilters}>Clear all filters</button>
              : <Link href="/upload" className="btn btn-primary">Upload Feedback</Link>
            }
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Feedback</th>
                    <th>Category</th>
                    <th>Sentiment</th>
                    <th>Source</th>
                    <th>Date</th>
                    <th>Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} style={{ opacity: item.isValid ? 1 : 0.55 }}>
                      <td className="td-primary">
                        <span
                          className="text-truncate"
                          title={item.feedbackText}
                          style={{ maxWidth: 400, color: item.isValid ? 'inherit' : 'var(--text-muted)', fontStyle: item.isValid ? 'normal' : 'italic' }}
                        >
                          {item.feedbackText || <em style={{ color: 'var(--text-muted)' }}>(empty)</em>}
                        </span>
                        {item.invalidReason && (
                          <div style={{ fontSize: 11, color: 'var(--negative)', marginTop: 2 }}>↳ {item.invalidReason}</div>
                        )}
                      </td>
                      <td>
                        {item.category
                          ? <span className="badge badge-brand" style={{ fontSize: 10 }}>{item.category}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>{sentimentBadge(item.sentiment)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.source || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                        {item.date
                          ? new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        <span className="text-truncate" style={{ maxWidth: 130, fontSize: 11, color: 'var(--text-muted)' }} title={item.batch?.name}>
                          {item.batch?.name || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <div className="pagination-info">
                    Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total.toLocaleString()}
                  </div>
                  <div className="pagination-controls">
                    <button className="page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} id="feedback-prev-page">←</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                      return (
                        <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)} id={`feedback-page-${p}`}>{p}</button>
                      )
                    })}
                    <button className="page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} id="feedback-next-page">→</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
