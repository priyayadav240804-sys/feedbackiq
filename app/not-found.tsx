import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '40px 20px', textAlign: 'center',
      background: 'var(--bg-base)',
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
        Page not found
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 380, lineHeight: 1.6, marginBottom: 28 }}>
        The page you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
      <Link href="/dashboard" className="btn btn-primary">← Back to Dashboard</Link>
    </div>
  )
}
