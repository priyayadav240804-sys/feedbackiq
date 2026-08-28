import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** GET /api/categories — returns distinct category + source values for filter dropdowns */
export async function GET() {
  try {
    const [categories, sources] = await Promise.all([
      prisma.feedbackItem.findMany({
        where:    { isValid: true, category: { not: null } },
        select:   { category: true },
        distinct: ['category'],
        orderBy:  { category: 'asc' },
      }),
      prisma.feedbackItem.findMany({
        where:    { isValid: true, source: { not: null } },
        select:   { source: true },
        distinct: ['source'],
        orderBy:  { source: 'asc' },
      }),
    ])

    return NextResponse.json({
      categories: categories.map((c) => c.category).filter(Boolean),
      sources:    sources.map((s) => s.source).filter(Boolean),
    })
  } catch (err) {
    console.error('[categories] Error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
