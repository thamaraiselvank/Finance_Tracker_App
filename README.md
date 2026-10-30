# Finverse

Finverse is a personal finance workspace for tracking day-to-day money, building wealth, and keeping long-term plans visible. It brings transactions, accounts, assets, liabilities, goals, insurance, financial essentials, calculators, and AI-powered insights into one authenticated application.

## What it includes

- **Dashboard:** net worth, monthly cash flow, financial health, savings runway, goals, and recent activity.
- **Money and accounts:** record income and expenses, organize accounts, and review transaction history.
- **Wealth:** track assets and liabilities, portfolio allocation, and investment performance.
- **Goals and debt:** monitor goal progress, monthly savings pace, outstanding debt, and payoff plans.
- **Essentials and insurance:** review emergency-fund runway, savings rate, insurance coverage, and policy payment dates.
- **Planning tools:** financial calculators, CSV/Excel and text-based PDF transaction import, and an AI advisor.
- **Authentication:** account access with bearer-token authentication and refresh-token support.
- **AI financial assistant:** authenticated, user-scoped financial summaries are sent from the backend to Gemini on Vertex AI; greetings and out-of-scope requests are handled locally.

## Project layout

```text
.
├── backend/
│   ├── app/
│   │   ├── core/       # Settings, security, and database access
│   │   ├── routers/    # FastAPI endpoints
│   │   ├── schemas/    # Request and response models
│   │   └── services/   # Financial calculations and business logic
│   ├── db/             # Database initialization and schema files
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
└── README.md
```

The frontend is a React 18 single-page application built with Vite, Tailwind CSS, Recharts, and Lucide icons. The backend is a FastAPI service using Pydantic schemas and PostgreSQL connection pooling.

## Statement import

Transaction imports support CSV, legacy `.xls` and `.xlsx` Excel files, and PDF bank statements, including scanned/image-only PDFs through local English-language OCR. PDF uploads can be password-protected; the password is used only while parsing the upload and is not stored. OCR runs on the backend with no external OCR or LLM service. PDF extraction combines text tables with OCR recovery for missed rows and headerless continuation pages; OCR uses the first-page column layout, groups wrapped narration with its transaction, and ignores opening-balance lines. When a running balance is available, changes are checked against the transaction amount. Rows without reliable direction are left unclassified and cannot be imported until corrected and explicitly reviewed or excluded. DOCX statements are not supported. PDF uploads are limited to 15 MB, text-based PDFs to 200 pages, and OCR to 20 pages per upload; imports are limited to 5,000 transactions.

The backend container installs Tesseract OCR and its English language data. For local backend development, install Tesseract OCR with English language data and make the `tesseract` executable available on `PATH`.

## Requirements

- Python 3.10 or later
- Node.js and npm
- PostgreSQL for local development and deployment

## Run locally on Windows

Start the backend and frontend in separate PowerShell terminals.

### 1. Backend

From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
if (-not (Test-Path ..\.env)) { Copy-Item .env.example ..\.env }
```

Edit the repository-root `.env` before starting the service. Set a private `SECRET_KEY` and configure `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` for your PostgreSQL instance. Create the configured database first if it does not exist.

Then, from the `backend/` directory:

```powershell
uvicorn app.main:app --reload
```

The API runs at <http://127.0.0.1:8000>. Interactive API documentation is at <http://127.0.0.1:8000/docs>, and the health check is at <http://127.0.0.1:8000/api/health>.

The backend requires PostgreSQL. If PostgreSQL is unavailable or its credentials are incorrect, startup fails with a clear connection error; it does not create or switch to a local SQLite database. The `/api/health` endpoint returns HTTP 503 when PostgreSQL cannot be reached.

### Gemini AI advisor (Vertex AI)

The AI advisor uses the Google Gen AI SDK on the backend. For local development, authenticate with `gcloud auth application-default login` using an account that has permission to call Vertex AI. The configured project ID is the default; set `GEMINI_PROJECT`, `GEMINI_LOCATION`, or `GEMINI_MODEL` in the repository-root `.env` to override it. No Google credential or API key belongs in the frontend.

For Cloud Run, grant the service's runtime service account the Vertex AI User role on the Google Cloud project, then set the same `GEMINI_*` environment variables on the service. Application Default Credentials will use that service identity; do not deploy a downloaded service-account key. `GEMINI_ENABLED=false` disables model calls. Model name, location, temperature, output-token limit, and the JSON `AI_GUARDRAILS_FILE` path are configurable. Guardrail phrases and regular-expression patterns live in `backend/app/data/ai_guardrails.json`.

The model never writes or executes SQL. The backend assembles bounded summaries with parameterized queries scoped to the authenticated user and sends those summaries with the question to Vertex AI. Conversation turns are stored in the existing `ai_conversations` table, scoped to the owner, and the latest thread is restored when the advisor opens. Greetings, configured blocked patterns, and clearly non-financial questions are answered before the model call. Keep the frontend's deployed origin in `BACKEND_CORS_ORIGINS` when using Firebase Hosting.

AI usage is capped at 30 Gemini-backed user questions per day by default (`AI_DAILY_REQUEST_LIMIT`). The calendar day resets in `AI_QUOTA_TIMEZONE` (default `Asia/Kolkata`). A separate cross-instance burst guard allows 5 chat/new-conversation requests per 60-second window by default; configure it with `AI_BURST_REQUESTS_PER_MINUTE` and `AI_BURST_WINDOW_SECONDS`. The limits are enforced in PostgreSQL, so they apply across tabs and Cloud Run instances. A multi-step model/tool flow still consumes one daily question, local greeting/guardrail replies consume none, and failed AI requests release their daily reservation.

### 2. Frontend

In a second terminal, from the repository root:

```powershell
cd frontend
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Open <http://localhost:5173>. The Vite development server forwards `/api` requests to the backend at `http://127.0.0.1:8000`. `VITE_API_BASE_URL` is optional for the default local setup; it can be set in `frontend/.env` when the API is hosted elsewhere.

If PowerShell blocks virtual-environment activation, allow it for the current terminal session and activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

## Useful commands

Run these from the relevant folder:

```powershell
# frontend/
npm run dev       # Start Vite development server
npm run build     # Create a production build in frontend/dist
npm run preview   # Preview the production build
```

```powershell
# backend/ with its virtual environment activated
uvicorn app.main:app --reload
```

## Configuration notes

- The backend loads `.env` from the repository root. Start from `backend/.env.example` and copy it to the root as shown above.
- The frontend loads its own `frontend/.env`. Start from `frontend/.env.example`.
- For production, set a unique `SECRET_KEY` with at least 32 characters and set `BACKEND_CORS_ORIGINS` to a JSON array containing only the deployed frontend origin(s), for example `["https://your-app.example"]`. Wildcard CORS origins are rejected in production.
- The PostgreSQL connection pool defaults to 1–5 connections per backend instance. When deploying to Cloud Run, set a maximum instance count and size the pool so that `maximum instances × PG_MAX_POOL_SIZE` stays within the database connection limit.
- `.gitignore` excludes local environment files, virtual environments, frontend build/dependency directories, caches, logs, and local SQLite databases. The example environment files remain trackable.
- Do not use the example `SECRET_KEY` outside local development. Do not commit real credentials or user financial data.
