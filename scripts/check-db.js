const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const [batches, analyzedCount, problemCount] = await Promise.all([
    p.feedbackBatch.findMany({ select: { id: true, name: true, status: true, validRows: true } }),
    p.feedbackItem.count({ where: { sentiment: { not: null } } }),
    p.problemGroup.count(),
  ])
  console.log('Batches:', JSON.stringify(batches, null, 2))
  console.log('Analyzed items:', analyzedCount)
  console.log('Problem groups:', problemCount)
  await p.$disconnect()
}

main().catch(console.error)
