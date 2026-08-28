import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Papa from 'papaparse'

// Accepted column name aliases (case-insensitive)
const COLUMN_ALIASES: Record<string, string[]> = {
  feedbackText: ['feedback', 'feedback_text', 'feedbacktext', 'text', 'review', 'comment', 'message', 'body', 'content', 'description'],
  date:         ['date', 'created_at', 'createdat', 'timestamp', 'time', 'submitted_at', 'submitted'],
  source:       ['source', 'channel', 'origin', 'type'],
  platform:     ['platform', 'app', 'os', 'device', 'environment'],
  userId:       ['user_id', 'userid', 'user', 'customer_id', 'customerid', 'customer'],
}

function findColumn(headers: string[], fieldKey: keyof typeof COLUMN_ALIASES): string | null {
  const aliases = COLUMN_ALIASES[fieldKey]
  for (const header of headers) {
    if (aliases.includes(header.toLowerCase().trim())) {
      return header
    }
  }
  return null
}

function parseDate(value: string): Date | null {
  if (!value || value.trim() === '') return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const batchName = (formData.get('name') as string) || 'Untitled Upload'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV (.csv)' }, { status: 400 })
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File is too large (max 10MB)' }, { status: 400 })
    }

    const csvText = await file.text()

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    // Parse CSV
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({
        error: 'Could not parse CSV file. Please check the file format.',
        details: parsed.errors.slice(0, 3).map((e) => e.message),
      }, { status: 400 })
    }

    const headers = parsed.meta.fields || []

    // Find required column
    const feedbackCol = findColumn(headers, 'feedbackText')
    if (!feedbackCol) {
      return NextResponse.json({
        error: 'Missing required column: feedback text.',
        hint: `Accepted column names: ${COLUMN_ALIASES.feedbackText.join(', ')}`,
        foundColumns: headers,
      }, { status: 400 })
    }

    // Find optional columns
    const dateCol     = findColumn(headers, 'date')
    const sourceCol   = findColumn(headers, 'source')
    const platformCol = findColumn(headers, 'platform')
    const userIdCol   = findColumn(headers, 'userId')

    const rows = parsed.data as Record<string, string>[]

    // Create batch
    const batch = await prisma.feedbackBatch.create({
      data: {
        name: batchName,
        totalRows: rows.length,
        status: 'done',
      },
    })

    // Track seen texts for duplicate detection (within this upload)
    const seenTexts = new Set<string>()
    let validCount = 0
    let invalidCount = 0

    const items = rows.map((row) => {
      const rawText = feedbackCol ? String(row[feedbackCol] ?? '').trim() : ''
      const rawRow  = JSON.stringify(row)

      // Validation checks
      if (!rawText) {
        invalidCount++
        return {
          batchId:      batch.id,
          feedbackText: '',
          rawRow,
          isValid:      false,
          invalidReason: 'Empty feedback text',
        }
      }

      if (rawText.length < 3) {
        invalidCount++
        return {
          batchId:      batch.id,
          feedbackText: rawText,
          rawRow,
          isValid:      false,
          invalidReason: 'Feedback text too short (< 3 characters)',
        }
      }

      const normalizedText = rawText.toLowerCase()
      if (seenTexts.has(normalizedText)) {
        invalidCount++
        return {
          batchId:      batch.id,
          feedbackText: rawText,
          rawRow,
          isValid:      false,
          invalidReason: 'Duplicate feedback (within this upload)',
        }
      }
      seenTexts.add(normalizedText)

      validCount++

      const parsedDate = dateCol ? parseDate(String(row[dateCol] ?? '')) : null

      return {
        batchId:      batch.id,
        feedbackText: rawText,
        date:         parsedDate,
        source:       sourceCol   ? (String(row[sourceCol]   ?? '').trim() || null) : null,
        platform:     platformCol ? (String(row[platformCol] ?? '').trim() || null) : null,
        userId:       userIdCol   ? (String(row[userIdCol]   ?? '').trim() || null) : null,
        rawRow,
        isValid:      true,
      }
    })

    // Bulk insert in chunks to avoid SQLite limits
    const CHUNK_SIZE = 500
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      await prisma.feedbackItem.createMany({ data: items.slice(i, i + CHUNK_SIZE) })
    }

    // Update batch counts
    await prisma.feedbackBatch.update({
      where: { id: batch.id },
      data: { validRows: validCount, invalidRows: invalidCount },
    })

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      batchName,
      totalRows:   rows.length,
      validRows:   validCount,
      invalidRows: invalidCount,
      detectedColumns: {
        feedbackText: feedbackCol,
        date:         dateCol,
        source:       sourceCol,
        platform:     platformCol,
        userId:       userIdCol,
      },
    })
  } catch (err) {
    console.error('[upload] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}
