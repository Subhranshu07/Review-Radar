# Review Radar — Customer Decision Engine

> Paste any Amazon product URL. Get 500–1000 reviews analyzed, competitor gaps mapped, and your listing rewritten by AI — in under 2 minutes.

---

## What It Does

Review Radar is a full-stack market intelligence tool for Amazon sellers. You give it a product URL and it automatically:

1. **Scrapes your listing** — title, bullet points, price, rating, BSR, and estimated monthly revenue
2. **Finds 9 real competitors** — searches Amazon for the same category, filters out same-brand products and accessories (price-filtered), gives you genuine competing brands
3. **Collects 500–1,000 reviews** — from your product and all 9 competitors combined
4. **Runs an AI analysis pipeline** — one Groq LLM call that acts as 5 expert roles simultaneously:
   - Customer Analyst — purchase drivers, key phrases, buyer persona, emotional triggers
   - Complaint Detector — top complaints ranked by severity, return reasons, unmet expectations
   - Competitor Strategist — what competitors do better, your weaknesses/strengths, missed positioning
   - Product Manager — 5 prioritised fixes ranked by impact vs effort, feature gaps, quick wins
   - Copywriter — rewritten title, 5 new bullet points, marketing angles, ad headlines
5. **Displays a premium dashboard** — all insights in a shareable report with revenue charts and a side-by-side listing comparison

Supports **amazon.com** and **amazon.in**, and accepts all URL formats including short `amzn.in/d/...` links.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Animations | Framer Motion |
| Routing | Wouter |
| Data fetching | TanStack Query |
| Backend | Node.js + Express |
| Database | PostgreSQL + Drizzle ORM |
| AI | Groq (llama-3.1-8b-instant) |
| Scraping | Axios + Cheerio + ScraperAPI fallback |
| API contract | OpenAPI 3.0 + Orval codegen |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
review-radar/
├── artifacts/
│   ├── review-radar/        # React frontend (Vite)
│   └── api-server/          # Express API + pipeline
│       └── src/
│           ├── routes/      # REST endpoints
│           └── services/
│               ├── scraper.ts   # Amazon scraping + URL resolution
│               ├── pipeline.ts  # Orchestration logic
│               └── groq.ts      # AI analysis (single consolidated call)
├── lib/
│   ├── db/                  # Drizzle schema + migrations
│   └── api-spec/            # OpenAPI spec + codegen output
└── scripts/                 # Shared utilities
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL database
- [Groq API key](https://console.groq.com) (free tier works)
- [ScraperAPI key](https://scraperapi.com) (optional but recommended for reliability)

### 1. Clone and install

```bash
git clone https://github.com/yourusername/review-radar.git
cd review-radar
pnpm install
```

### 2. Set environment variables

Create a `.env` file in `artifacts/api-server/`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/review_radar
GROQ_API_KEY=your_groq_api_key
SCRAPERAPI_KEY=your_scraperapi_key   # optional
SESSION_SECRET=any_random_string
PORT=8080
```

### 3. Set up the database

```bash
cd lib/db
pnpm run push
```

### 4. Run the development servers

In separate terminals:

```bash
# API server
pnpm --filter @workspace/api-server run dev

# Frontend
pnpm --filter @workspace/review-radar run dev
```

The frontend runs on port 5173 and the API on port 8080.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyze` | Start a new analysis (returns `shareToken`) |
| `GET` | `/api/status/:shareToken` | Poll processing status + progress |
| `GET` | `/api/report/:shareToken` | Fetch the full completed report |
| `GET` | `/api/reports/recent` | Latest 6 public reports |
| `GET` | `/api/reports/history` | Paginated report history |
| `GET` | `/api/stats` | Aggregate platform statistics |

---

## Accepted URL Formats

```
https://www.amazon.in/dp/B0DWMQDYSZ
https://www.amazon.com/dp/B0DWMQDYSZ
https://amazon.in/dp/B0DWMQDYSZ
https://amzn.in/d/02RJrT7Z          ← short URL, auto-resolved
https://amzn.com/d/02RJrT7Z         ← short URL, auto-resolved
https://www.amazon.com/Product-Name/dp/B0DWMQDYSZ/ref=sr_1_1   ← full search URL
```

Short URLs are resolved server-side by following the HTTP redirect chain before processing.

---

## Rate Limiting

- 3 analyses per IP per hour
- Groq: uses `llama-3.1-8b-instant` (131,072 tokens/minute) — single API call per analysis keeps well within free tier limits

---

## Competitor Discovery Logic

Competitors are filtered through three layers:
1. **Brand filter** — same-brand products are excluded
2. **Price filter** — products more than 80% cheaper than the main product are excluded (removes accessories, remotes, cases, etc.)
3. **Smart search query** — brand name, model numbers, colors, and marketing words are stripped from the title before searching, leaving only the core product category keywords

---

## Revenue Estimates

Revenue figures are estimates based on Amazon BSR (Best Seller Rank), calibrated for the Indian market:

| BSR | Daily Units Estimate |
|---|---|
| ≤ 100 | 30 |
| ≤ 500 | 16 |
| ≤ 1,000 | 10 |
| ≤ 5,000 | 5 |
| ≤ 10,000 | 2 |
| ≤ 50,000 | 1 |

These are projections, not actual sales data.

---

## Regenerating API Client

If you modify `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## License

MIT
