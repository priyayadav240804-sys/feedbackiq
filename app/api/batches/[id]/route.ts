/**
 * DELETE /api/batches/[id]
 * Deletes a batch and all its associated FeedbackItems.
 * ProblemGroups that become empty (no items in any batch) are also cleaned up.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const batch = await prisma.feedbackBatch.findUnique({ where: { id } })
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Collect problem groups linked to items in this batch
    const linkedGroups = await prisma.feedbackItem.findMany({
      where:  { batchId: id, problemGroupId: { not: null } },
      select: { problemGroupId: true },
    })
    const groupIds = [...new Set(linkedGroups.map((i) => i.problemGroupId).filter(Boolean))]

    // Delete items first (FK constraint)
    await prisma.feedbackItem.deleteMany({ where: { batchId: id } })

    // Delete the batch
    await prisma.feedbackBatch.delete({ where: { id } })

    // Clean up now-empty problem groups
    for (const gid of groupIds) {
      const remaining = await prisma.feedbackItem.count({ where: { problemGroupId: gid! } })
      if (remaining === 0) {
        await prisma.problemGroup.delete({ where: { id: gid! } })
      } else {
        // Update feedbackCount to reflect remaining items
        await prisma.problemGroup.update({
          where: { id: gid! },
          data:  { feedbackCount: remaining },
        })
      }
    }

    return NextResponse.json({ success: true, deleted: id })
  } catch (err) {
    console.error('[batch-delete] Error:', err)
    return NextResponse.json({ error: 'Failed to delete batch' }, { status: 500 })
  }
}
