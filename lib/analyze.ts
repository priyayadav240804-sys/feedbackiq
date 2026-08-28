/**
 * lib/analyze.ts
 * 
 * Two-phase AI analysis pipeline:
 *   Phase A — Categorize each feedback item + detect sentiment (batched, 15/call)
 *   Phase B — Group all items into named customer problems/themes (one call)
 */

import { groq, GROQ_MODEL_FAST, GROQ_MODEL_SMART } from './groq'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Sentiment = 'Positive' | 'Neutral' | 'Negative'

export const CATEGORIES = [
  'Performance',
  'Bug / Crash',
  'UI / UX',
  'Onboarding',
  'Billing / Pricing',
  'Authentication',
  'Notifications',
  'Search',
  'Data & Export',
  'Integrations',
  'Mobile App',
  'Customer Support',
  'Feature Request',
  'General Positive',
  'Other',
] as const

export type Category = typeof CATEGORIES[number]

export interface ItemAnalysis {
  index: number
  category: Category
  sentiment: Sentiment
}

export interface ProblemGroupResult {
  title: string
  summary: string
  dominantSentiment: Sentiment
  feedbackIndices: number[]  // indices into the input array
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safely parse JSON from AI output — strips markdown code fences if present */
function parseJsonFromAI(raw: string): unknown {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()
  return JSON.parse(cleaned)
}

/** Sleep helper for retry backoff */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Call Groq with automatic retry on rate-limit (429) */
async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  retries = 3,
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,  // Low temperature for consistent, factual output
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      })
      return completion.choices[0]?.message?.content || ''
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error && err.message.includes('429')
      if (isRateLimit && attempt < retries - 1) {
        const wait = (attempt + 1) * 8000  // 8s, 16s backoff
        console.warn(`[analyze] Rate limited. Retrying in ${wait}ms…`)
        await sleep(wait)
      } else {
        throw err
      }
    }
  }
  throw new Error('Groq call failed after retries')
}

// ─── Phase A: Categorization + Sentiment ─────────────────────────────────────

const CATEGORIZE_SYSTEM = `You are a product analytics assistant. 
Your job is to categorize customer feedback and detect sentiment.

Categories available:
${CATEGORIES.map((c) => `- ${c}`).join('\n')}

Sentiments: Positive | Neutral | Negative

RULES:
- Be consistent: similar complaints should get the same category.
- Sentiment should reflect the customer's emotional tone, not the topic.
- If text is ambiguous, prefer Neutral.
- Respond ONLY with valid JSON matching the schema exactly.`

const CATEGORIZE_USER = (items: { index: number; text: string }[]) => `
Analyze each feedback item below and return JSON in this exact format:
{
  "results": [
    { "index": <number>, "category": "<Category>", "sentiment": "<Sentiment>" },
    ...
  ]
}

Feedback items:
${items.map((i) => `[${i.index}] "${i.text}"`).join('\n')}
`

/**
 * Phase A: Categorize a batch of feedback items.
 * Processes BATCH_SIZE items per Groq call to stay within token limits.
 */
export async function categorizeFeedback(
  items: { id: string; feedbackText: string }[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, ItemAnalysis>> {
  const BATCH_SIZE = 15
  const results = new Map<string, ItemAnalysis>()

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const indexed = batch.map((item, j) => ({ index: i + j, text: item.feedbackText }))

    let parsed: { results: ItemAnalysis[] }

    try {
      const raw = await callGroq(CATEGORIZE_SYSTEM, CATEGORIZE_USER(indexed), GROQ_MODEL_FAST)
      parsed = parseJsonFromAI(raw) as { results: ItemAnalysis[] }
    } catch (err) {
      console.error(`[analyze] Batch ${i}–${i + BATCH_SIZE} failed:`, err)
      // Fallback: mark all as Other/Neutral
      batch.forEach((item, j) => {
        results.set(item.id, { index: i + j, category: 'Other', sentiment: 'Neutral' })
      })
      continue
    }

    // Map results back to item IDs
    parsed.results?.forEach((r) => {
      const originalIndex = r.index - i  // relative to this batch
      if (originalIndex >= 0 && originalIndex < batch.length) {
        results.set(batch[originalIndex].id, {
          index: r.index,
          category: r.category || 'Other',
          sentiment: r.sentiment || 'Neutral',
        })
      }
    })

    onProgress?.(Math.min(i + BATCH_SIZE, items.length), items.length)

    // Polite delay between batches to avoid rate limits
    if (i + BATCH_SIZE < items.length) {
      await sleep(1500)
    }
  }

  return results
}

// ─── Phase B: Problem Grouping ────────────────────────────────────────────────

const GROUP_SYSTEM = `You are a senior Product Manager assistant.
Your job is to analyze customer feedback and identify distinct customer problems/themes.

RULES:
- Group feedback by the underlying customer problem, NOT just by category.
- Each group should represent a specific, actionable problem a PM could address.
- Title should be specific: "App crashes on iOS 18 after update" NOT "Bug Issues".
- Summary should be 1-2 sentences explaining the core problem and its impact.
- A feedback item can only belong to ONE problem group.
- Ignore or lump trivial/general feedback into a "General Feedback" group.
- Create between 5 and 15 groups depending on the data.
- Respond ONLY with valid JSON matching the schema exactly.`

const GROUP_USER = (
  items: { index: number; text: string; category: string; sentiment: string }[],
) => `
Analyze these ${items.length} customer feedback items and group them into distinct customer problems.

Return JSON in this exact format:
{
  "problems": [
    {
      "title": "<specific problem title>",
      "summary": "<1-2 sentence description of the problem and its customer impact>",
      "dominantSentiment": "<Positive|Neutral|Negative>",
      "feedbackIndices": [<array of index numbers from the input below>]
    }
  ]
}

Feedback items (index | category | sentiment | text):
${items.map((i) => `[${i.index}] [${i.category}] [${i.sentiment}] "${i.text}"`).join('\n')}
`

/**
 * Phase B: Group categorized items into customer problem clusters.
 */
export async function groupIntoProblems(
  items: { id: string; feedbackText: string; category: Category; sentiment: Sentiment }[],
): Promise<ProblemGroupResult[]> {
  if (items.length === 0) return []

  const indexed = items.map((item, i) => ({
    index: i,
    text: item.feedbackText,
    category: item.category,
    sentiment: item.sentiment,
  }))

  const raw = await callGroq(GROUP_SYSTEM, GROUP_USER(indexed), GROQ_MODEL_SMART)
  const parsed = parseJsonFromAI(raw) as { problems: ProblemGroupResult[] }

  if (!parsed.problems || !Array.isArray(parsed.problems)) {
    throw new Error('AI returned unexpected format for problem grouping')
  }

  return parsed.problems
}
