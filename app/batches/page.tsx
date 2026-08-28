'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Batch {
  id: string
  name: string
  uploadedAt: string
  totalRows: number
  validRows: number
  invalidRows: number
  status: string
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'done':       return <span className="badge badge-positive">✓ done</span>
    case 'processing': return <span className="badge badge-info">⟳ processing</span>
    case 'failed':     return <span className="badge badge-negative">✗ failed</span>
    default:           return <span className="badge badge-neutral">{status}</span>
  }
}

export default function BatchesPage() {
  const [batches, setBatches]           = useState<Batch[]>([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [analyzingId, setAnalyzingId]   = useState<string | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [statusMsg, setStatusMsg]       = useState<{ id: string; msg: string; ok: boolean } | null>(null)
  const [groqReady, setGroqReady]       = useState(false)

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    try {
      const [batchRes, statsRes] = await Promise.all([
        fetch('/api/batches?limit=50'),
        fetch('/api/dashboard-stats'),
      ])
      const batchData = await batchRes.json()
      const statsData = await statsRes.json()
      setBatches(batchData.batches)
      setTotal(batchData.total)
      setGroqReady(statsData.groqConfigured)
    } catch {
      setError('Failed to load upload history.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBatches() }, [fetchBatches])

  const handleAnalyze = async (batch: Batch) => {
    setAnalyzingId(batch.id)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: batch.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatusMsg({ id: batch.id, msg: `✓ ${data.stats.analyzed} items categorized, ${data.stats.problems} problems identified`, ok: true })
        await fetchBatches()
      } else {
        setStatusMsg({ id: batch.id, msg: `✗ ${data.error}${data.hint ? ` — ${data.hint}` : ''}`, ok: false })
        await fetchBatches()
      }
    } catch {
      setStatusMsg({ id: batch.id, msg: '✗ Network error. Please try again.', ok: false })
    } finally {
      setAnalyzingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/batches/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setBatches((prev) => prev.filter((b) => b.id !== id))
        setTotal((t) => t - 1)
      } else {
        setError('Failed to delete batch. Please try again.')
      }
    } catch {
      setError('Network error while deleting.')
    } finally {
      setDeletingId(null)
    }
  }

  const validPercent = (b: Batch) =>
    b.totalRows > 0 ? Math.round((b.validRows / b.totalRows) * 100) : 0

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Upload History</div>
          <div className="topbar-subtitle">
            {total > 0 ? `${total} upload${total !== 1 ? 's' : ''}` : 'No uploads yet'}
          </div>
        </div>
        <div className="topbar-actions">
          <Link href="/upload" className="btn btn-primary btn-sm">+ New Upload</Link>
        </div>
      </div>

      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : batches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <div className="empty-title">No uploads yet</div>
            <div className="empty-body">Upload a CSV file to see it here.</div>
            <Link href="/upload" className="btn btn-primary">Upload Feedback</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="card"
                style={{ padding: '18px 22px', borderLeft: `3px solid ${batch.status === 'done' ? 'var(--positive)' : batch.status === 'failed' ? 'var(--negative)' : 'var(--border-muted)'}` }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{batch.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(batch.uploadedAt).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                  {statusBadge(batch.status)}
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
                  {[
                    { label: 'Total', value: batch.totalRows, color: 'var(--text-primary)' },
                    { label: 'Valid',   value: batch.validRows,   color: 'var(--positive)' },
                    ...(batch.invalidRows > 0 ? [{ label: 'Skipped', value: batch.invalidRows, color: 'var(--negative)' }] : []),
                  ].map((s) => (
                    <div key={s.label}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                {/* Quality bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                    <span>Data quality</span>
                    <span>{validPercent(batch)}% valid</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${validPercent(batch)}%` }} />
                  </div>
                </div>

                {/* Status message for this batch */}
                {statusMsg?.id === batch.id && (
                  <div className={`alert ${statusMsg.ok ? 'alert-info' : 'alert-warning'}`} style={{ marginBottom: 12, padding: '8px 12px', fontSize: 12 }}>
                    {statusMsg.msg}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Link
                    href={`/feedback?batchId=${batch.id}`}
                    className="btn btn-secondary btn-sm"
                    id={`view-batch-${batch.id}`}
                  >
                    View feedback →
                  </Link>

                  {groqReady && batch.status !== 'processing' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleAnalyze(batch)}
                      disabled={analyzingId === batch.id}
                      id={`analyze-batch-${batch.id}`}
                    >
                      {analyzingId === batch.id
                        ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Analyzing…</>
                        : batch.status === 'done' ? '🤖 Re-analyze' : '🤖 Run Analysis'}
                    </button>
                  )}

                  {/* Delete — confirm before executing */}
                  {confirmDelete === batch.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--negative)' }}>Delete this batch and all its data?</span>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--negative)', color: '#fff', borderColor: 'var(--negative)' }}
                        onClick={() => handleDelete(batch.id)}
                        disabled={deletingId === batch.id}
                        id={`confirm-delete-${batch.id}`}
                      >
                        {deletingId === batch.id ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}
                      onClick={() => setConfirmDelete(batch.id)}
                      id={`delete-batch-${batch.id}`}
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
