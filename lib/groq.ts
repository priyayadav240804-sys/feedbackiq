import Groq from 'groq-sdk'

const globalForGroq = globalThis as unknown as { groq: Groq | undefined }

export const groq =
  globalForGroq.groq ??
  new Groq({ apiKey: process.env.GROQ_API_KEY || '' })

if (process.env.NODE_ENV !== 'production') globalForGroq.groq = groq

/**
 * Fast model for high-volume batched tasks (categorization, sentiment).
 * Smaller = cheaper/faster under rate limits.
 */
export const GROQ_MODEL_FAST = process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b'

/**
 * Capable model for complex reasoning tasks (problem grouping).
 */
export const GROQ_MODEL_SMART = process.env.GROQ_MODEL_SMART || 'openai/gpt-oss-120b'

/** Returns true when a valid API key is configured */
export function isGroqConfigured(): boolean {
  const key = process.env.GROQ_API_KEY
  return typeof key === 'string' && key.trim().length > 0
}
