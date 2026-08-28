# FeedbackIQ

FeedbackIQ is an AI-powered customer feedback intelligence platform designed for Product Managers. It takes raw, unstructured customer feedback (from app reviews, support tickets, surveys, etc.) and uses AI to automatically categorize it, analyze sentiment, and group it into actionable product insights and problem clusters.

## Features (MVP)

*   **CSV Feedback Upload:** Easily upload batches of customer feedback (requires a `feedbackText` column).
*   **AI Categorization & Sentiment Analysis:** Automatically categorizes feedback and determines sentiment (Positive, Neutral, Negative) using fast AI models.
*   **Problem Grouping:** AI intelligently groups similar feedback into distinct "Problem Groups" with auto-generated titles and summaries.
*   **Interactive Dashboard:** View key metrics, sentiment breakdown, top problems, and a trend chart of feedback volume over time.
*   **Evidence Trail:** Dive into specific problem groups to see the exact user quotes that led to the AI's conclusions.
*   **Advanced Filtering:** Filter all feedback by category, sentiment, and source.
*   **Responsive Design:** Works beautifully on desktop, tablet, and mobile devices.

## Tech Stack

*   **Framework:** Next.js 14 (App Router)
*   **Language:** TypeScript
*   **Database:** SQLite via Prisma ORM
*   **AI Provider:** Groq (using high-speed open-source models like `gpt-oss-120b` and `gpt-oss-20b`)
*   **Styling:** Custom CSS (Design Tokens, Dark Mode by default)

## Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   A free Groq API key (get one at [console.groq.com](https://console.groq.com))

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/feedbackiq.git
    cd feedbackiq
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory and add your Groq API key:
    ```env
    DATABASE_URL="file:./dev.db"
    GROQ_API_KEY="your_api_key_here"
    GROQ_MODEL_FAST="openai/gpt-oss-20b"
    GROQ_MODEL_SMART="openai/gpt-oss-120b"
    ```

4.  **Database Setup:**
    Push the Prisma schema to create the SQLite database:
    ```bash
    npm run db:push
    ```

5.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

## Demo / Seeding Data

To quickly see FeedbackIQ in action with realistic data, you can use the included seed script. It uploads two sample datasets (SaaS app reviews and E-commerce feedback) and runs the AI analysis.

*Make sure your `.env` is configured with a valid `GROQ_API_KEY` before running this.*

1. Start the dev server in one terminal: `npm run dev`
2. In a separate terminal, run: `npm run seed`

## Architecture overview

*   **`app/api/analyze/route.ts`**: The core AI orchestration pipeline. Handles batched categorization (Phase A) and problem grouping (Phase B) while respecting API rate limits.
*   **`lib/analyze.ts`**: Contains the specific prompts and Groq API calls for parsing and structuring AI responses.
*   **`lib/groq.ts`**: Groq client initialization and model configuration.
*   **`prisma/schema.prisma`**: Defines the `FeedbackBatch`, `FeedbackItem`, and `ProblemGroup` models.

## Phase Roadmap

*   [x] **Phase 1:** Foundation (Next.js, Prisma, UI Shell, File Upload)
*   [x] **Phase 2:** Feedback Processing (Groq Integration, AI Pipeline, Real Data Views)
*   [x] **Phase 3:** MVP Dashboard (Trend Charts, Advanced Filters)
*   [x] **Phase 4:** Testing & Refinement (Edge Cases, Deletion, Error Boundaries)
*   [x] **Phase 5:** Final Polish (Responsive Design, Demo Script, Documentation)
