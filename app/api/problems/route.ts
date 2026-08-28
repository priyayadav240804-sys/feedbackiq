import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page      = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit     = Math.min(50, parseInt(searchParams.get('limit') || '20'))
    const skip      = (page - 1) * limit
    const sentiment = searchParams.get('sentiment') || ''
    const search    = searchParams.get('search')?.trim() || ''

    const where: Record<string, unknown> = {}
    if (sentiment) where.sentiment = sentiment
    if (search)    where.title = { contains: search }

    const [problems, total] = await Promise.all([
      prisma.problemGroup.findMany({
        where,
        orderBy: { feedbackCount: 'desc' },
        skip,
        take: limit,
      }),
      prisma.problemGroup.count({ where }),
    ])

    return NextResponse.json({ problems, total, page, limit })
  } catch (err) {
    console.error('[problems] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch problems' }, { status: 500 })
  }
}
