/**
 * POST /api/analyze
 * Body: { batchId: string }
 *
 * Runs the two-phase AI analysis pipeline on a specific batch:
 *   1. Categorize + sentiment each FeedbackItem
 *   2. Group items into ProblemGroups
 *
 * Updates FeedbackItem rows in-place and creates/updates ProblemGroup rows.
 * Existing analysis for the batch is cleared before re-running.
 */

// Allow up to 60s on Vercel Hobby (max allowed)
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isGroqConfigured } from '@/lib/groq'
import { categorizeFeedback, groupIntoProblems } from '@/lib/analyze'
import type { Category, Sentiment } from '@/lib/analyze'

export async function POST(req: NextRequest) {
  // ── Guard: API key must be set ────────────────────────────────────────────
  if (!isGroqConfigured()) {
    return NextResponse.json(
      {
        error: 'Groq API key not configured.',
        hint: 'Add GROQ_API_KEY to your .env file and restart the dev server.',
      },
      { status: 503 },
    )
  }

  let batchId: string
  try {
    const body = await req.json()
    batchId = body.batchId
    if (!batchId || typeof batchId !== 'string') {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // ── Fetch batch ───────────────────────────────────────────────────────────
  const batch = await prisma.feedbackBatch.findUnique({ where: { id: batchId } })
  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  // ── Mark batch as processing ──────────────────────────────────────────────
  await prisma.feedbackBatch.update({
    where: { id: batchId },
    data: { status: 'processing' },
  })

  try {
    // ── Fetch all valid feedback items for this batch ─────────────────────
    const items = await prisma.feedbackItem.findMany({
      where: { batchId, isValid: true },
      select: { id: true, feedbackText: true },
      orderBy: { createdAt: 'asc' },
    })

    if (items.length === 0) {
      await prisma.feedbackBatch.update({
        where: { id: batchId },
        data: { status: 'done' },
      })
      return NextResponse.json({
        success: true,
        message: 'No valid feedback items to analyze.',
        stats: { analyzed: 0, problems: 0 },
      })
    }

    // ── Clear any prior ProblemGroups linked to items in this batch ────────
    const existingGroupIds = await prisma.feedbackItem.findMany({
      where: { batchId, problemGroupId: { not: null } },
      select: { problemGroupId: true },
    })
    const groupIds = [...new Set(existingGroupIds.map((i) => i.problemGroupId).filter(Boolean))]
    if (groupIds.length > 0) {
      // Unlink items first to avoid FK constraint
      await prisma.feedbackItem.updateMany({
        where: { batchId },
        data: { problemGroupId: null, category: null, sentiment: null },
      })
      // Delete problem groups that have no remaining items
      for (const gid of groupIds) {
        const remaining = await prisma.feedbackItem.count({ where: { problemGroupId: gid! } })
        if (remaining === 0) {
          await prisma.problemGroup.delete({ where: { id: gid! } })
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE A — Categorize + Sentiment
    // ════════════════════════════════════════════════════════════════════════
    console.log(`[analyze] Phase A: categorizing ${items.length} items…`)

    const analysisMap = await categorizeFeedback(items, (done, total) => {
      console.log(`[analyze] Phase A progress: ${done}/${total}`)
    })

    // Write Phase A results to DB
    const updateOps = Array.from(analysisMap.entries()).map(([id, result]) =>
      prisma.feedbackItem.update({
        where: { id },
        data: {
          category:  result.category,
          sentiment: result.sentiment,
        },
      }),
    )
    await Promise.all(updateOps)

    console.log(`[analyze] Phase A complete. ${analysisMap.size} items categorized.`)

    // ════════════════════════════════════════════════════════════════════════
    // PHASE B — Problem Grouping
    // ════════════════════════════════════════════════════════════════════════
    console.log(`[analyze] Phase B: grouping into problems…`)

    // Build enriched item list for grouping
    const enrichedItems = items.map((item) => {
      const analysis = analysisMap.get(item.id)
      return {
        id: item.id,
        feedbackText: item.feedbackText,
        category: (analysis?.category || 'Other') as Category,
        sentiment: (analysis?.sentiment || 'Neutral') as Sentiment,
      }
    })

    const problemGroups = await groupIntoProblems(enrichedItems)

    console.log(`[analyze] Phase B complete. ${problemGroups.length} problems identified.`)

    // Write ProblemGroups to DB and link FeedbackItems
    let totalProblemsCreated = 0
    for (const pg of problemGroups) {
      if (!pg.feedbackIndices || pg.feedbackIndices.length === 0) continue

      // Resolve indices → item IDs
      const linkedItemIds = pg.feedbackIndices
        .filter((idx) => idx >= 0 && idx < enrichedItems.length)
        .map((idx) => enrichedItems[idx].id)

      if (linkedItemIds.length === 0) continue

      const group = await prisma.problemGroup.create({
        data: {
          title:         pg.title,
          summary:       pg.summary,
          sentiment:     pg.dominantSentiment,
          feedbackCount: linkedItemIds.length,
        },
      })

      await prisma.feedbackItem.updateMany({
        where: { id: { in: linkedItemIds } },
        data:  { problemGroupId: group.id },
      })

      totalProblemsCreated++
    }

    // ── Mark batch done ───────────────────────────────────────────────────
    await prisma.feedbackBatch.update({
      where: { id: batchId },
      data:  { status: 'done' },
    })

    return NextResponse.json({
      success:  true,
      batchId,
      stats: {
        analyzed: analysisMap.size,
        problems: totalProblemsCreated,
      },
    })
  } catch (err: unknown) {
    console.error('[analyze] Error:', err)

    await prisma.feedbackBatch.update({
      where: { id: batchId },
      data:  { status: 'failed' },
    })

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Analysis failed.', details: message },
      { status: 500 },
    )
  }
}
