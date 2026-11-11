# Procurement Audit Dashboard

Internal audit platform for **Master Group of Industries** — live PR/PO/GRN analytics, role-based access, day-end PDF reporting, a procurement Command Center, and an in-dashboard **Audit Assistant** chatbot that answers from real aggregates (not guesses).

| Layer | Stack | Default port |
|-------|--------|--------------|
| Frontend | Next.js 15 (App Router), React 19, TanStack Query, Recharts, Tailwind CSS 4 | `3033` |
| Backend | Express, MySQL (`mysql2`), OpenAI tool-calling, PDFKit / pdf-lib | `5057` |
| Source data | External procurement + GRN feed APIs | `6070` |

---

## What it does

### Executive dashboard
- KPI cards: unique PRs, POs, approved / pending POs, total spend (PKR + foreign converted)
- Charts: procurement funnel, approval mix, creators / approvers, department spend, legal entity, monthly trend, vendors, aging, purchase-type mix, PO revision analysis
- **GRN module**: PO→GRN funnel, aging, receiving org, monthly receipts, vendor quality / returns
- **Split-PO risk watch**: heuristic detection for orders that may be split under approval limits
- Paginated audit + GRN tables with Excel export
- Cross-filter drill-down (company, department, creator, date range, etc.)
- Dark / light theme, live data-feed status, permission-gated sections

### Command Center
- Real-time style network view of procurement flow (nodes, links, pipeline, activity ticker)
- Optional alert sound when fresh activity appears

### Day-end reporting
- Build a scoped day-end report from allowed dashboard components
- Remarks + signature pad → PDF generation → lock for the day
- Optional SMTP email to configured recipients

### Admin & security
- JWT cookie auth (default seed admin on first DB connect)
- Per-user **permissions** (which KPIs / charts / features appear)
- Per-user **data access** (organizations / domains) so non-admin users only see assigned companies
- Chatbot is itself a gated feature (`feature-chatbot`)

### Audit Assistant (chatbot)
Floating chat on the main dashboard. Built for bilingual office use (Roman Urdu, English, Punjabi, Urdu script) with voice input (`ur-PK`).

**How it works (high level):**

1. UI calls `GET /chat/status` then `POST /chat/ask` with the message, active dashboard filters, and short history.
2. Backend checks OpenAI config, chatbot permission, and a simple per-user rate limit (20 / min).
3. Message pipeline:
   - Detect reply language / style
   - Day-end “share report” intent → UI opens remarks + signature card (no fake success from the model)
   - Resolve company / date scope from natural language (Karachi “today”, aliases like Procon / Master)
   - Fast small-talk path for greetings / thanks (no tools)
   - Topic guards: questions outside the user’s assigned dashboard rights get a polite refusal
   - Fast-paths for common KPI / company / creator / vendor questions using the same services as the dashboard
   - Otherwise OpenAI **tool calling** against live aggregates (`get_kpis`, `list_purchase_orders`, `get_grn_summary`, `get_group_comparison`, …) — numbers always come from tools
4. Optional embeddings store per-user Q&A memory for similar-question hints (facts still refreshed from tools).
5. Admin users are never soft-blocked by permission refusals; recovery path re-answers from KPIs if the model wrongly refuses.

**Chat endpoints**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/chat/status` | Configured? Allowed for this user? |
| `POST` | `/chat/ask` | Ask a question (auth required) |

---

## Architecture

```
Browser (Next.js :3033)
    │  JWT cookie
    ▼
Express API (:5057)
    ├── /auth, /admin          → MySQL (users, permissions, data access)
    ├── /dashboard/*           → cached PR/PO + GRN feeds → aggregates
    ├── /reports/*             → PDF + email
    └── /chat/*                → OpenAI + same aggregate services + tool ACL
            │
            ├── DATA_URL  (procurement rows)
            └── PO2GRN_URL (GRN rows)
```

**Business rules (summary)**
- PRs counted by unique `REQ_NO`; POs by unique `PO_NO`
- Approved when final approver / `PO_APPROVE == "APPROVE"` (see backend helpers)
- Aging: PO creation date − PR creation date
- Spend: sum of `PO_AMT` with currency conversion helpers for foreign amounts

---

## Project layout

```
Audit_dashboard/
├── package.json              # root scripts (install / run both apps)
├── .gitignore                # blocks .env, node_modules, build output
├── backend/
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── chat/             # Audit Assistant
│       ├── routes/           # auth, admin, dashboard, reports
│       └── services/         # data, GRN, PDF, permissions, …
└── frontend/
    ├── package.json
    └── src/
        ├── app/              # login, dashboard, admin, command-center
        ├── components/       # dashboard, chat, command-center, ui
        ├── context/          # auth + filters
        └── lib/api.ts        # typed API client
```

---

## Quick start

### Prerequisites
- Node.js 20+
- MySQL with database `Audit_Dashboard` (or set `DB_NAME`)
- Reachable source APIs (`DATA_URL`, `PO2GRN_URL`)
- OpenAI API key (for the chatbot)

### 1. Environment

Create a local `.env` in the **project root** (never commit this file). Minimum keys:

```env
PORT=5057
CORS_ORIGIN=http://localhost:3033
JWT_SECRET=change-me-to-a-long-random-string
DATA_URL=http://localhost:6070/callcenterreportdata
PO2GRN_URL=http://localhost:6070/callcenterreportdata/po2grn
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=Audit_Dashboard
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```


Optional frontend override in `frontend/.env.local` (also gitignored):

```env
NEXT_PUBLIC_API_URL=http://localhost:5057
```

### 2. Install & run

From repo root:

```bash
npm run install:all
npm run dev:backend    # http://localhost:5057
npm run dev:frontend   # http://localhost:3033
```

Or separately:

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

### 3. Login
On first successful DB connection the API seeds an admin user if missing:

- Username: `admin`
- Password: `Admin@123` *(change immediately in production)*

Grant `feature-chatbot` (and any KPI/chart rights you want the bot to discuss) from the Admin panel for non-admin users.

---

## Main API surface

| Area | Examples |
|------|----------|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Dashboard | `/dashboard/kpis`, `/spend`, `/table`, `/insights`, `/grn/*`, `/command-center`, … |
| Reports | day-end create / PDF / status / email |
| Admin | users, permissions, data-access, report email recipients |
| Chat | `/chat/status`, `/chat/ask` |
| Health | `GET /health` |

All dashboard + chat routes (except auth/health) require a valid session cookie.

Common filter query params: `organization`, `operatingUnit`, `department`, `prCreator`, `poCreator`, `approver`, `approvalStatus`, `year`, `month`, `dateFrom`, `dateTo`, `search`.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run install:all` | Install backend + frontend deps |
| `npm run dev:backend` | Express with `--watch` |
| `npm run dev:frontend` | Next.js on port 3033 |
| `npm run start:backend` / `start:frontend` | Production-style start |

---

## Notes for reviewers

- Aggregation and ACL live on the **backend**; the UI only renders what permissions allow.
- The chatbot never invents spend/PR/PO counts — it calls the same services the charts use.
- Source feeds are cached with background refresh (`CACHE_TTL_MS` / stale window) so the dashboard stays responsive.
- Do not commit `.env` or `.env.local` — both are gitignored. Keep secrets only on your machine / server.

---

## License

Private / internal use — Master Group of Industries procurement audit tooling.
