'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const TrendChart = dynamic(() => import('@/components/TrendChart'), { ssr: false })

interface DashboardStats {
  totalFeedback: number
  totalBatches: number
  totalProblems: number
  analyzedCount: number
  sentiment: { Positive: number; Neutral: number; Negative: number }
  latestBatch: {
    id: string
    name: string
    uploadedAt: string
    validRows: number
    invalidRows: number
    status: string
  } | null
  recentProblems: {
    id: string
    title: string
    summary: string
    sentiment: string | null
    feedbackCount: number
  }[]
  groqConfigured: boolean
}

function SentimentBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const total = positive + neutral + negative
  if (total === 0) return <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 99 }} />
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
      {positive > 0 && <div style={{ width: pct(positive), background: 'var(--positive)', borderRadius: 99 }} />}
      {neutral  > 0 && <div style={{ width: pct(neutral),  background: 'var(--neutral)',  borderRadius: 99 }} />}
      {negative > 0 && <div style={{ width: pct(negative), background: 'var(--negative)', borderRadius: 99 }} />}
    </div>
  )
}

const sentimentIcon: Record<string, string> = {
  Positive: '😊',
  Neutral:  '😐',
  Negative: '😞',
}

const sentimentBadgeClass: Record<string, string> = {
  Positive: 'badge-positive',
  Neutral:  'badge-neutral',
  Negative: 'badge-negative',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [analyzeSuccess, setAnalyzeSuccess] = useState('')

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard-stats')
      const data = await res.json()
      setStats(data)
    } catch {
      // Silent fail — page still renders
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const handleAnalyze = async () => {
    if (!stats?.latestBatch) return
    setAnalyzing(true)
    setAnalyzeError('')
    setAnalyzeSuccess('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: stats.latestBatch.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAnalyzeError(data.error + (data.hint ? ` — ${data.hint}` : ''))
      } else {
        setAnalyzeSuccess(`✓ Analysis complete! ${data.stats.analyzed} items categorized, ${data.stats.problems} problems found.`)
        await fetchStats()
      }
    } catch {
      setAnalyzeError('Network error. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const hasData     = (stats?.totalFeedback ?? 0) > 0
  const hasAnalysis = (stats?.analyzedCount  ?? 0) > 0
  const hasProblems = (stats?.totalProblems  ?? 0) > 0
  const { Positive = 0, Neutral = 0, Negative = 0 } = stats?.sentiment ?? {}
  const sentimentTotal = Positive + Neutral + Negative

  const pct = (n: number) =>
    sentimentTotal > 0 ? `${Math.round((n / sentimentTotal) * 100)}%` : '—'

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Dashboard</div>
          <div className="topbar-subtitle">Customer feedback intelligence overview</div>
        </div>
        <div className="topbar-actions">
          {hasData && stats?.latestBatch?.status !== 'processing' && (
            <button
              className="btn btn-secondary"
              onClick={handleAnalyze}
              disabled={analyzing || !stats?.groqConfigured}
              id="run-analysis-btn"
              title={!stats?.groqConfigured ? 'Add GROQ_API_KEY to .env to enable AI analysis' : ''}
            >
              {analyzing ? (
                <><div className="spinner" style={{ width: 14, height: 14 }} /> Analyzing…</>
              ) : (
                <>🤖 Run AI Analysis</>
              )}
            </button>
          )}
          <Link href="/upload" className="btn btn-primary" id="dashboard-upload-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload Feedback
          </Link>
        </div>
      </div>

      <div className="page-content fade-in">

        {/* Analyze alerts */}
        {analyzeError   && <div className="alert alert-error"   style={{ marginBottom: 20 }}>{analyzeError}</div>}
        {analyzeSuccess && <div className="alert alert-success" style={{ marginBottom: 20 }}>{analyzeSuccess}</div>}

        {/* API key warning */}
        {hasData && !stats?.groqConfigured && (
          <div className="alert alert-warning" style={{ marginBottom: 20 }}>
            <div>
              <strong>Groq API key not set.</strong> Add <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 4 }}>GROQ_API_KEY</code> to your <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 4 }}>.env</code> file and restart the dev server to enable AI analysis.
              <div style={{ marginTop: 4, fontSize: 12 }}>Get a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--neutral)', textDecoration: 'underline' }}>console.groq.com/keys</a></div>
            </div>
          </div>
        )}

        {loading ? (
          /* Skeleton */
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--radius-lg)' }} />
              ))}
            </div>
          </div>
        ) : !hasData ? (
          /* Empty state */
          <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 32 }}>
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <div className="empty-title">No feedback data yet</div>
              <div className="empty-body">
                Upload a CSV of customer feedback to get started. FeedbackIQ will
                detect sentiment, categorize topics, and group similar complaints
                into actionable customer problems — all powered by Groq AI.
              </div>
              <Link href="/upload" className="btn btn-primary">Upload your first CSV</Link>
            </div>

            <div className="card" style={{ marginTop: 28 }}>
              <div className="card-header"><span className="card-title">What you'll see here</span></div>
              {[
                { icon: '💬', label: 'Total feedback', desc: 'Count of valid items across all uploads' },
                { icon: '😊', label: 'Sentiment split', desc: 'Positive / Neutral / Negative from Groq AI' },
                { icon: '🔥', label: 'Top problems', desc: 'AI-grouped themes ranked by frequency' },
                { icon: '📈', label: 'Trends', desc: 'Available in Phase 3 when date data is present' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 22 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Stat Cards ── */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              {/* Total feedback */}
              <div className="stat-card brand">
                <div className="stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                </div>
                <div className="stat-label">Total Feedback</div>
                <div className="stat-value">{stats!.totalFeedback.toLocaleString()}</div>
                <div className="stat-sub">{stats!.totalBatches} upload{stats!.totalBatches !== 1 ? 's' : ''}</div>
              </div>

              {/* Analyzed */}
              <div className="stat-card" style={{ background: 'var(--bg-surface)' }}>
                <div className="stat-icon">
                  <span style={{ fontSize: 16 }}>🤖</span>
                </div>
                <div className="stat-label">AI Analyzed</div>
                <div className="stat-value" style={{ color: hasAnalysis ? 'var(--brand-light)' : 'var(--text-muted)' }}>
                  {hasAnalysis ? stats!.analyzedCount.toLocaleString() : '—'}
                </div>
                <div className="stat-sub">
                  {hasAnalysis
                    ? `${Math.round((stats!.analyzedCount / stats!.totalFeedback) * 100)}% of total`
                    : 'Run AI analysis above'}
                </div>
              </div>

              {/* Problems */}
              <div className="stat-card negative">
                <div className="stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--negative)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div className="stat-label">Problems Found</div>
                <div className="stat-value" style={{ color: hasProblems ? 'var(--negative)' : 'var(--text-muted)' }}>
                  {hasProblems ? stats!.totalProblems : '—'}
                </div>
                <div className="stat-sub">{hasProblems ? 'customer problem clusters' : 'pending analysis'}</div>
              </div>

              {/* Negative % */}
              <div className="stat-card positive">
                <div className="stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--positive)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
                  </svg>
                </div>
                <div className="stat-label">Negative Rate</div>
                <div className="stat-value" style={{ color: hasAnalysis ? 'var(--negative)' : 'var(--text-muted)' }}>
                  {hasAnalysis ? pct(Negative) : '—'}
                </div>
                <div className="stat-sub">{hasAnalysis ? `${Negative.toLocaleString()} items` : 'pending analysis'}</div>
              </div>
            </div>

            {/* ── Sentiment Breakdown ── */}
            {hasAnalysis && (
              <div className="two-col" style={{ marginBottom: 24 }}>
                <div className="card">
                  <div className="card-header"><span className="card-title">Sentiment Breakdown</span></div>
                  <div style={{ marginBottom: 14 }}>
                    <SentimentBar positive={Positive} neutral={Neutral} negative={Negative} />
                  </div>
                  {[
                    { label: 'Positive', count: Positive, cls: 'badge-positive', color: 'var(--positive)' },
                    { label: 'Neutral',  count: Neutral,  cls: 'badge-neutral',  color: 'var(--neutral)' },
                    { label: 'Negative', count: Negative, cls: 'badge-negative', color: 'var(--negative)' },
                  ].map((row) => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{sentimentIcon[row.label]}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.count.toLocaleString()}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{pct(row.count)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Latest Batch */}
                {stats?.latestBatch && (
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Latest Upload</span>
                      <Link href="/batches" className="btn btn-ghost btn-sm">All uploads →</Link>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{stats.latestBatch.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(stats.latestBatch.uploadedAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valid</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--positive)' }}>{stats.latestBatch.validRows}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Skipped</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--negative)' }}>{stats.latestBatch.invalidRows}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                        <div style={{ marginTop: 4 }}>
                          <span className={`badge ${stats.latestBatch.status === 'done' ? 'badge-positive' : stats.latestBatch.status === 'processing' ? 'badge-info' : 'badge-neutral'}`}>
                            {stats.latestBatch.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    {stats.latestBatch.status !== 'processing' && stats.groqConfigured && (
                      <button className="btn btn-secondary btn-sm w-full" onClick={handleAnalyze} disabled={analyzing} id="batch-analyze-btn" style={{ width: '100%', justifyContent: 'center' }}>
                        {analyzing ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Analyzing…</> : '🤖 Re-run Analysis'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Trend Chart ── */}
            {hasAnalysis && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                  <span className="card-title">📈 Feedback Volume Over Time</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hover over points for daily breakdown</span>
                </div>
                <TrendChart />
              </div>
            )}

            {/* ── Top Problems ── */}
            {hasProblems ? (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">🔥 Top Customer Problems</span>
                  <Link href="/problems" className="btn btn-ghost btn-sm">View all →</Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {stats!.recentProblems.map((p, i) => (
                    <Link
                      key={p.id}
                      href={`/problems/${p.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 14px', borderRadius: 'var(--radius-md)',
                        border: '1px solid transparent', transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-muted)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
                    >
                      <div style={{
                        width: 28, height: 28, flexShrink: 0,
                        background: i === 0 ? 'rgba(239,68,68,0.15)' : i === 1 ? 'rgba(245,158,11,0.12)' : 'var(--bg-elevated)',
                        border: `1px solid ${i === 0 ? 'rgba(239,68,68,0.3)' : i === 1 ? 'rgba(245,158,11,0.2)' : 'var(--border-muted)'}`,
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800, color: i === 0 ? 'var(--negative)' : i === 1 ? 'var(--neutral)' : 'var(--text-muted)',
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.summary}</div>
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {p.sentiment && (
                          <span className={`badge ${sentimentBadgeClass[p.sentiment] || 'badge-muted'}`}>{p.sentiment}</span>
                        )}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{p.feedbackCount}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>reports</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : hasData && !hasAnalysis ? (
              /* Needs analysis CTA */
              <div className="card" style={{ borderColor: 'rgba(99,102,241,0.3)', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      🤖 Ready for AI Analysis
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {stats!.totalFeedback} feedback items uploaded. Run AI analysis to detect sentiment, categorize topics, and group customer problems.
                    </div>
                  </div>
                  {stats?.groqConfigured ? (
                    <button className="btn btn-primary" onClick={handleAnalyze} disabled={analyzing} style={{ flexShrink: 0 }}>
                      {analyzing ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Analyzing…</> : '🤖 Run Analysis'}
                    </button>
                  ) : (
                    <span className="badge badge-neutral" style={{ fontSize: 12, padding: '6px 14px', flexShrink: 0 }}>Add GROQ_API_KEY first</span>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}
