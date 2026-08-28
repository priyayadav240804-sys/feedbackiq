/**
 * scripts/seed.js
 *
 * Seeds the FeedbackIQ database with both sample CSV files and runs
 * AI analysis on each batch. Run with:
 *
 *   node scripts/seed.js
 *
 * Prerequisites:
 *   1. npm run db:push   (create the database)
 *   2. GROQ_API_KEY set in .env
 *   3. Dev server NOT running (this script accesses the DB directly
 *      and calls the local API, so start the server first in another terminal)
 *
 * If the server is running:
 *   1. Open a separate terminal → npm run dev
 *   2. Run this script → node scripts/seed.js
 */

const fs   = require('fs')
const path = require('path')
const FormData = require('form-data')

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL  = process.env.APP_URL || 'http://localhost:3000'
const CSV_FILES = [
  {
    file: path.join(__dirname, '../sample-data/sample_feedback.csv'),
    name: 'SaaS App Reviews — Sample Batch',
  },
  {
    file: path.join(__dirname, '../sample-data/ecommerce_feedback.csv'),
    name: 'E-Commerce Feedback — Sample Batch',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const log  = (msg)  => console.log(`  ${msg}`)
const ok   = (msg)  => console.log(`  ✓ ${msg}`)
const fail = (msg)  => console.error(`  ✗ ${msg}`)
const hr   = ()     => console.log('\n' + '─'.repeat(56))

async function uploadCSV(filePath, name) {
  const form = new FormData()
  form.append('file', fs.createReadStream(filePath), path.basename(filePath))
  form.append('name', name)

  const res = await fetch(`${BASE_URL}/api/upload`, {
    method:  'POST',
    body:    form,
    headers: form.getHeaders(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload failed ${res.status}: ${text}`)
  }
  return res.json()
}

async function analyzeBlatch(batchId) {
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ batchId }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error + (data.hint ? ` — ${data.hint}` : ''))
  }
  return res.json()
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🧠 FeedbackIQ — Demo Seed Script')
  console.log('   Uploading sample data and running AI analysis…')
  hr()

  // Check server reachability
  try {
    const ping = await fetch(`${BASE_URL}/api/dashboard-stats`)
    if (!ping.ok) throw new Error('Server returned non-200')
    const stats = await ping.json()
    ok(`Server reachable at ${BASE_URL}`)
    if (!stats.groqConfigured) {
      fail('GROQ_API_KEY not set — analysis will be skipped')
      fail('Add GROQ_API_KEY to .env and restart the dev server')
      process.exit(1)
    }
    ok('Groq API key detected')
  } catch (err) {
    fail(`Cannot reach ${BASE_URL} — is the dev server running?`)
    fail('Run "npm run dev" in another terminal first.')
    process.exit(1)
  }

  hr()
  let totalAnalyzed = 0
  let totalProblems = 0

  for (const { file, name } of CSV_FILES) {
    if (!fs.existsSync(file)) {
      fail(`File not found: ${file}`)
      continue
    }

    console.log(`\n📄 ${name}`)
    log(`File: ${path.basename(file)}`)

    // Upload
    log('Uploading CSV…')
    let uploadResult
    try {
      uploadResult = await uploadCSV(file, name)
    } catch (err) {
      fail(`Upload error: ${err.message}`)
      continue
    }

    if (!uploadResult.success) {
      fail(`Upload failed: ${uploadResult.error}`)
      continue
    }
    ok(`Uploaded: ${uploadResult.validRows} valid rows, ${uploadResult.invalidRows} skipped`)

    // Analyze
    log('Running AI analysis (this may take 30–60s)…')
    try {
      const result = await analyzeBlatch(uploadResult.batchId)
      ok(`Categorized: ${result.stats.analyzed} items`)
      ok(`Problems found: ${result.stats.problems} clusters`)
      totalAnalyzed += result.stats.analyzed
      totalProblems += result.stats.problems
    } catch (err) {
      fail(`Analysis error: ${err.message}`)
    }
  }

  hr()
  console.log('\n🎉 Seed complete!')
  ok(`Total items analyzed: ${totalAnalyzed}`)
  ok(`Total problem groups: ${totalProblems}`)
  console.log(`\n   Open your browser: ${BASE_URL}/dashboard\n`)
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err.message)
  process.exit(1)
})
