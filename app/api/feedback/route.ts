import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const page      = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit     = Math.min(100, parseInt(searchParams.get('limit') || '25'))
    const skip      = (page - 1) * limit
    const search    = searchParams.get('search')?.trim() || ''
    const batchId   = searchParams.get('batchId') || ''
    const sentiment = searchParams.get('sentiment') || ''
    const category  = searchParams.get('category') || ''
    const source    = searchParams.get('source') || ''
    const isValid   = searchParams.get('isValid')

    // Build where clause
    const where: Record<string, unknown> = {}

    if (search) {
      where.feedbackText = { contains: search }
    }

    if (batchId)   where.batchId   = batchId
    if (sentiment) where.sentiment = sentiment
    if (category)  where.category  = category
    if (source)    where.source    = source

    if (isValid === 'true')  where.isValid = true
    if (isValid === 'false') where.isValid = false

    const [items, total] = await Promise.all([
      prisma.feedbackItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { batch: { select: { name: true } } },
      }),
      prisma.feedbackItem.count({ where }),
    ])

    return NextResponse.json({ items, total, page, limit })
  } catch (err) {
    console.error('[feedback] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
