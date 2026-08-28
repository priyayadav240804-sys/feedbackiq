import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/trends
 * Returns daily feedback counts grouped by date, optionally filtered by batchId.
 * Only counts items that have a non-null date field.
 * Also returns per-sentiment breakdown per day.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const batchId = searchParams.get('batchId') || undefined

    const where: Record<string, unknown> = {
      isValid: true,
      date:    { not: null },
    }
    if (batchId) where.batchId = batchId

    const items = await prisma.feedbackItem.findMany({
      where,
      select: { date: true, sentiment: true },
      orderBy: { date: 'asc' },
    })

    if (items.length === 0) {
      return NextResponse.json({ hasDateData: false, daily: [] })
    }

    // Group by YYYY-MM-DD
    const dayMap = new Map<string, { total: number; Positive: number; Neutral: number; Negative: number }>()

    for (const item of items) {
      if (!item.date) continue
      const day = new Date(item.date).toISOString().slice(0, 10)
      if (!dayMap.has(day)) {
        dayMap.set(day, { total: 0, Positive: 0, Neutral: 0, Negative: 0 })
      }
      const entry = dayMap.get(day)!
      entry.total++
      const s = item.sentiment as 'Positive' | 'Neutral' | 'Negative' | null
      if (s && entry[s] !== undefined) entry[s]++
    }

    const daily = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }))

    return NextResponse.json({ hasDateData: true, daily, totalWithDate: items.length })
  } catch (err) {
    console.error('[trends] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 })
  }
}
