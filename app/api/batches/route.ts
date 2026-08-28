import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
    const skip  = (page - 1) * limit

    const [batches, total] = await Promise.all([
      prisma.feedbackBatch.findMany({
        orderBy: { uploadedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.feedbackBatch.count(),
    ])

    return NextResponse.json({ batches, total, page, limit })
  } catch (err) {
    console.error('[batches] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 })
  }
}
