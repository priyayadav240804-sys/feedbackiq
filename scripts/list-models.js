const Groq = require('groq-sdk')
const fs = require('fs')

const env = fs.readFileSync('.env', 'utf8')
const key = env.match(/GROQ_API_KEY="([^"]+)"/)?.[1]

if (!key) {
  console.error('No GROQ_API_KEY found in .env')
  process.exit(1)
}

const groq = new Groq({ apiKey: key })

groq.models.list()
  .then(r => {
    console.log('Available models:')
    r.data.forEach(m => console.log(' -', m.id))
  })
  .catch(e => console.error('Error:', e.message))
