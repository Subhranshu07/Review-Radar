# Review Radar

Paste an Amazon product URL. Get 500–1000 reviews analyzed, 9 competitors mapped, and your listing rewritten by AI — in under 2 minutes.

Supports **amazon.com**, **amazon.in**, and short `amzn.in/d/...` links.

---

## Stack

- **Frontend** — React + Vite + Tailwind + TanStack Query
- **Backend** — Node.js + Express + Drizzle ORM + PostgreSQL
- **AI** — Groq (`llama-3.1-8b-instant`)
- **Scraping** — Axios + Cheerio + ScraperAPI fallback
- **Monorepo** — pnpm workspaces

---

## Setup

```bash
git clone https://github.com/yourusername/review-radar.git
cd review-radar
pnpm install
```

Set environment variables in `artifacts/api-server/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/review_radar
GROQ_API_KEY=your_groq_key
SCRAPERAPI_KEY=your_scraperapi_key   # optional
SESSION_SECRET=any_random_string
PORT=8080
```

Push the database schema:

```bash
cd lib/db && pnpm run push
```

Run dev servers:

```bash
pnpm --filter @workspace/api-server run dev   # API on :8080
pnpm --filter @workspace/review-radar run dev  # UI on :5173
```

---

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyze` | Start analysis, returns `shareToken` |
| `GET` | `/api/status/:token` | Poll progress |
| `GET` | `/api/report/:token` | Fetch completed report |
| `GET` | `/api/reports/recent` | Latest public reports |
| `GET` | `/api/stats` | Platform stats |

---

## License

MIT
# Review-Radar
