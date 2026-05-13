# Authority Gap Engine — Backend

Node.js + Express + BullMQ + Postgres + Redis. Crawls a clinic site, extracts
signals, runs the scoring engine, layers AI interpretation, and returns a
full scan report.

## Quick start (local node)

```bash
npm install
cp .env.example .env       # set Supabase, Redis, and OpenAI values
npm run dev                # API on :4000
```

The backend loads `.env` from either `backend/.env` or the repo root `.env`.
Supabase accepts `SUPABASE_URL`, `VITE_SUPABASE_URL`, or
`NEXT_PUBLIC_SUPABASE_URL` for the URL, and `SUPABASE_SERVICE_KEY` or
`SUPABASE_SERVICE_ROLE_KEY` for the service role key.

## Quick start (Docker)

```bash
docker compose up --build
# API:    http://localhost:4000
# Health: curl http://localhost:4000/health
# Schema is auto-applied from sql/schema.sql on first boot
```

Test a scan:

```bash
curl -X POST http://localhost:4000/api/scan/start \
  -H "Content-Type: application/json" \
  -d '{"website_url":"https://example.com","clinic_type":"dental","location":"London"}'
```

## File tree

```
backend/
├── src/
│   ├── config/               Env parsing (reserved)
│   ├── lib/                  db, redis, logger
│   ├── middleware/           Express middleware (errorHandler)
│   ├── routes/               REST endpoints (scan, lead, event)
│   ├── services/             Domain logic
│   │   ├── crawlService.ts        Playwright fetch
│   │   ├── extractService.ts      Cheerio signal extraction
│   │   ├── ruleEngine.ts          Deterministic rules
│   │   ├── scoringEngine.ts       Scores 0–100
│   │   ├── opportunityModel.ts    Revenue range
│   │   ├── aiInterpretationService.ts  LLM narrative
│   │   └── reportComposer.ts      Final report assembly
│   ├── workers/              BullMQ workers (scanWorker)
│   ├── types/                Shared TS contracts
│   ├── utils/                Misc helpers (reserved)
│   ├── app.ts                Express app factory
│   └── server.ts             HTTP entry point
├── sql/
│   └── schema.sql            scans, leads, scan_events tables
├── scripts/                  Operational scripts (reserved)
├── Dockerfile
├── docker-compose.yml        api + worker + postgres + redis
├── .dockerignore
├── .env.example
├── package.json
└── tsconfig.json
```

## Services in `docker-compose.yml`

| Service  | Port | Notes                                            |
| -------- | ---- | ------------------------------------------------ |
| api      | 4000 | `node dist/server.js`                            |
| worker   | —    | `node dist/workers/scanWorker.js`                |
| postgres | 5432 | Auto-loads `sql/schema.sql` on first start       |
| redis    | 6379 | BullMQ queue                                     |
