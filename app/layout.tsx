import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'FeedbackIQ — AI-Powered Customer Feedback Intelligence',
  description: 'Turn raw customer feedback into actionable product insights. FeedbackIQ helps Product Managers analyze, categorize, and prioritize customer problems at scale.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
