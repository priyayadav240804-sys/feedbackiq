import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isGroqConfigured } from '@/lib/groq'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [
      totalFeedback,
      totalBatches,
      sentimentCounts,
      totalProblems,
      latestBatch,
      recentProblems,
    ] = await Promise.all([
      prisma.feedbackItem.count({ where: { isValid: true } }),
      prisma.feedbackBatch.count(),
      prisma.feedbackItem.groupBy({
        by: ['sentiment'],
        where: { isValid: true, sentiment: { not: null } },
        _count: true,
      }),
      prisma.problemGroup.count(),
      prisma.feedbackBatch.findFirst({ orderBy: { uploadedAt: 'desc' } }),
      prisma.problemGroup.findMany({
        orderBy: { feedbackCount: 'desc' },
        take: 5,
      }),
    ])

    const sentimentMap: Record<string, number> = {}
    for (const row of sentimentCounts) {
      if (row.sentiment) sentimentMap[row.sentiment] = row._count
    }

    const analyzedCount = sentimentCounts.reduce((sum, r) => sum + r._count, 0)

    return NextResponse.json({
      totalFeedback,
      totalBatches,
      totalProblems,
      analyzedCount,
      sentiment: {
        Positive: sentimentMap['Positive'] || 0,
        Neutral:  sentimentMap['Neutral']  || 0,
        Negative: sentimentMap['Negative'] || 0,
      },
      latestBatch,
      recentProblems,
      groqConfigured: isGroqConfigured(),
    })
  } catch (err) {
    console.error('[dashboard-stats] Error:', err)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
