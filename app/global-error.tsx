'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html>
      <body style={{ margin: 0, background: '#0d0f17', fontFamily: 'Inter, sans-serif' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '40px 20px', textAlign: 'center', color: '#e2e8f0',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#64748b', maxWidth: 400, lineHeight: 1.7, marginBottom: 28 }}>
            An unexpected error occurred. Try refreshing the page — if the problem persists, check the server logs.
          </p>
          {error?.digest && (
            <code style={{ fontSize: 11, color: '#475569', marginBottom: 24 }}>Error ID: {error.digest}</code>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={reset}
              style={{
                padding: '10px 20px', borderRadius: 8, border: '1px solid #334155',
                background: '#1e293b', color: '#e2e8f0', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
