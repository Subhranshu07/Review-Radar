# Review Radar — Customer Decision Engine

## Overview

Full-stack web application that turns Amazon reviews into actionable competitive intelligence for e-commerce sellers. Paste an Amazon product URL → app scrapes listing + 9 competitors + 500-1000 reviews → runs 5-role Groq AI pipeline → displays premium analytics dashboard.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui
- **Routing**: wouter
- **State**: TanStack Query (React Query)
- **Animations**: framer-motion

## Artifacts

- **`/`** — Review Radar frontend (react-vite, `artifacts/review-radar`)
- **`/api`** — API Server (Express, `artifacts/api-server`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Architecture

### Backend Services (`artifacts/api-server/src/services/`)

- **`scraper.ts`** — Amazon scraping with cheerio + axios; ScraperAPI fallback on bot-detection
- **`groq.ts`** — 5-role Groq AI pipeline (Customer Analyst, Complaint Detector, Competitor Strategist, Product Manager, Copywriter) using llama-3.3-70b-versatile
- **`pipeline.ts`** — Orchestrates scraping + AI; runs async in background; updates DB progress in real-time

### Backend Routes (`artifacts/api-server/src/routes/reports.ts`)

- `POST /api/analyze` — starts analysis, returns shareToken immediately
- `GET /api/status/:shareToken` — poll for progress (frontend polls every 3s)
- `GET /api/report/:shareToken` — full report data
- `GET /api/reports/recent` — last 10 completed reports
- `GET /api/reports/history` — all reports with optional search
- `GET /api/stats` — total reports + reviews analyzed

### Database Schema (`lib/db/src/schema/reports.ts`)

- `reports` — main report with product data, status, progress, revenue estimates
- `analysis_results` — all 5 AI role outputs (JSON stored as text)
- `competitors` — scraped competitor listings
- `ip_rate_limits` — rate limiting (max 3/hour/IP)

### Frontend Pages (`artifacts/review-radar/src/pages/`)

- `home.tsx` — hero with URL input, stats bar, recent reports grid
- `processing.tsx` — live progress with step indicators, polls every 3s
- `report.tsx` — 7-section premium analytics dashboard
- `history.tsx` — searchable table of all past reports

## Environment Variables Required

- `GROQ_API_KEY` — Groq API key for AI pipeline
- `SCRAPERAPI_KEY` — ScraperAPI key for scraping fallback
- `DATABASE_URL` — PostgreSQL connection (auto-provisioned)

## Revenue Estimation Formula

BSR ranges mapped to daily units × 30 × price = monthly revenue.
Aggregated across all 10 listings = total market size.

## Important Notes

- The `/api/analyze` endpoint returns immediately; all work runs in background
- Rate limit: 3 analyses per IP per hour
- Groq calls: 500ms delay between each to respect rate limits
- Reviews truncated to 6000 chars per Groq call
- Failed competitor scrapes are skipped silently (never crash whole report)
- JSON responses from Groq are parsed with try/catch + fallback empty arrays
