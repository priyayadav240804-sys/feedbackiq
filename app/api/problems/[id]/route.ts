import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [problem, feedbackItems] = await Promise.all([
      prisma.problemGroup.findUnique({ where: { id } }),
      prisma.feedbackItem.findMany({
        where: { problemGroupId: id, isValid: true },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          feedbackText: true,
          sentiment: true,
          category: true,
          date: true,
          source: true,
          platform: true,
          userId: true,
          batch: { select: { name: true } },
        },
      }),
    ])

    if (!problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
    }

    // Sentiment breakdown for this problem
    const sentimentBreakdown = feedbackItems.reduce(
      (acc, item) => {
        if (item.sentiment) acc[item.sentiment] = (acc[item.sentiment] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Source breakdown
    const sourceBreakdown = feedbackItems.reduce(
      (acc, item) => {
        const src = item.source || 'Unknown'
        acc[src] = (acc[src] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return NextResponse.json({
      problem,
      feedbackItems,
      sentimentBreakdown,
      sourceBreakdown,
    })
  } catch (err) {
    console.error('[problem-detail] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch problem detail' }, { status: 500 })
  }
}
