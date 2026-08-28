'use client'

import type { Metadata } from 'next'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UploadResult {
  success: boolean
  batchId?: string
  batchName?: string
  totalRows?: number
  validRows?: number
  invalidRows?: number
  detectedColumns?: Record<string, string | null>
  error?: string
  hint?: string
  foundColumns?: string[]
  details?: string[]
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [batchName, setBatchName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [analyzeStatus, setAnalyzeStatus] = useState<'idle'|'running'|'done'|'error'>('idle')
  const [analyzeMessage, setAnalyzeMessage] = useState('')

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setResult({ success: false, error: 'Please upload a .csv file' })
      return
    }
    setFile(f)
    setResult(null)
    // Auto-fill batch name from filename
    if (!batchName) {
      setBatchName(f.name.replace('.csv', '').replace(/[_-]/g, ' '))
    }
  }, [batchName])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }, [handleFile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setProgress(10)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', batchName || file.name)

      setProgress(40)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      setProgress(80)

      const data: UploadResult = await res.json()
      setProgress(100)
      setResult(data)

      if (data.success && data.batchId) {
        // Check if Groq key is configured, then auto-analyze
        const statsRes = await fetch('/api/dashboard-stats')
        const statsData = await statsRes.json()
        if (statsData.groqConfigured) {
          setAnalyzeStatus('running')
          setAnalyzeMessage('Running AI analysis…')
          try {
            const analyzeRes = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ batchId: data.batchId }),
            })
            const analyzeData = await analyzeRes.json()
            if (analyzeRes.ok) {
              setAnalyzeStatus('done')
              setAnalyzeMessage(`🤖 AI analysis complete! ${analyzeData.stats.analyzed} items categorized, ${analyzeData.stats.problems} problems identified.`)
            } else {
              setAnalyzeStatus('error')
              setAnalyzeMessage(`AI analysis failed: ${analyzeData.error}`)
            }
          } catch {
            setAnalyzeStatus('error')
            setAnalyzeMessage('AI analysis failed — you can run it manually from the Dashboard.')
          }
        }

        // Reset form after a delay
        setTimeout(() => {
          setFile(null)
          setBatchName('')
          setProgress(0)
        }, 4000)
      }
    } catch {
      setResult({ success: false, error: 'Network error. Please try again.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Upload Feedback</div>
          <div className="topbar-subtitle">Import customer feedback from a CSV file</div>
        </div>
      </div>

      <div className="page-content fade-in">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Upload Form */}
          <form onSubmit={handleSubmit}>
            {/* Drop Zone */}
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
              style={file ? { borderColor: 'var(--brand-primary)', background: 'var(--brand-glow)' } : {}}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                id="csv-file-input"
              />

              {file ? (
                /* File selected state */
                <div>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                  <div className="upload-title">{file.name}</div>
                  <div className="upload-subtitle">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null) }}
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                /* Empty state */
                <>
                  <div className="upload-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-light)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <div className="upload-title">Drop your CSV here</div>
                  <div className="upload-subtitle">or click to browse files</div>
                  <span className="upload-hint">Only .csv files · Max 10MB</span>
                </>
              )}
            </div>

            {/* Batch Name */}
            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label" htmlFor="batch-name">
                Upload name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="batch-name"
                className="form-input"
                placeholder="e.g. App Store Reviews - August 2025"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                maxLength={120}
              />
            </div>

            {/* Progress */}
            {uploading && (
              <div style={{ marginBottom: 16 }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  {progress < 40 ? 'Reading file…' : progress < 80 ? 'Uploading…' : 'Processing…'}
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  {result.success ? (
                    <>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>✓ Upload successful!</div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>
                        {result.totalRows} rows processed · {result.validRows} valid · {result.invalidRows} skipped
                      </div>
                      {result.detectedColumns && (
                        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.75 }}>
                          Detected columns: {Object.entries(result.detectedColumns)
                            .filter(([, v]) => v !== null)
                            .map(([k, v]) => `${k} → "${v}"`)
                            .join(' · ')}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>✗ {result.error}</div>
                      {result.hint && <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>{result.hint}</div>}
                      {result.foundColumns && result.foundColumns.length > 0 && (
                        <div style={{ fontSize: 11, opacity: 0.75 }}>
                          Found columns: {result.foundColumns.join(', ')}
                        </div>
                      )}
                      {result.details && result.details.length > 0 && (
                        <ul style={{ fontSize: 11, marginTop: 4, paddingLeft: 16, opacity: 0.75 }}>
                          {result.details.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* AI Analysis Status */}
            {analyzeMessage && (
              <div className={`alert ${analyzeStatus === 'done' ? 'alert-info' : analyzeStatus === 'error' ? 'alert-warning' : 'alert-info'}`} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {analyzeStatus === 'running' && <div className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />}
                  <div>{analyzeMessage}</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!file || uploading}
                id="upload-submit-btn"
                style={{ opacity: (!file || uploading) ? 0.5 : 1 }}
              >
                {uploading ? (
                  <><div className="spinner" style={{ width: 14, height: 14 }} /> Processing…</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Upload &amp; Process
                  </>
                )}
              </button>
              {result?.success && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => router.push('/feedback')}
                >
                  View Feedback →
                </button>
              )}
            </div>
          </form>

          {/* CSV Format Guide */}
          <div className="card" style={{ marginTop: 32 }}>
            <div className="card-header">
              <span className="card-title">📋 Expected CSV Format</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
              FeedbackIQ auto-detects column names. The only required column is the <strong style={{ color: 'var(--text-primary)' }}>feedback text</strong>.
            </div>

            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Column</th>
                    <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Required</th>
                    <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Accepted Names</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { col: 'Feedback Text', req: true,  names: 'feedback, feedback_text, text, review, comment, message' },
                    { col: 'Date',          req: false, names: 'date, created_at, timestamp, submitted_at' },
                    { col: 'Source',        req: false, names: 'source, channel, origin' },
                    { col: 'Platform',      req: false, names: 'platform, app, os, device' },
                    { col: 'User ID',       req: false, names: 'user_id, userid, customer_id' },
                  ].map((row) => (
                    <tr key={row.col} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.col}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`badge ${row.req ? 'badge-negative' : 'badge-muted'}`}>
                          {row.req ? 'Required' : 'Optional'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{row.names}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>Example CSV:</div>
              <div style={{ color: 'var(--positive)' }}>feedback,date,source,platform</div>
              <div>&quot;The app crashes every time I open it&quot;,2025-08-01,App Store,iOS</div>
              <div>&quot;Login is slow and frustrating&quot;,2025-08-02,Support,Android</div>
              <div>&quot;Love the new dashboard!&quot;,2025-08-03,Survey,Web</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
