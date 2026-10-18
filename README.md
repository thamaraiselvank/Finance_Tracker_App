# Finverse

Finverse is a personal finance workspace for tracking day-to-day money, building wealth, and keeping long-term plans visible. It brings transactions, accounts, assets, liabilities, goals, insurance, financial essentials, calculators, and AI-powered insights into one authenticated application.

## What it includes

- **Dashboard:** net worth, monthly cash flow, financial health, savings runway, goals, and recent activity.
- **Money and accounts:** record income and expenses, organize accounts, and review transaction history.
- **Wealth:** track assets and liabilities, portfolio allocation, and investment performance.
- **Goals and debt:** monitor goal progress, monthly savings pace, outstanding debt, and payoff plans.
- **Essentials and insurance:** review emergency-fund runway, savings rate, insurance coverage, and policy payment dates.
- **Planning tools:** financial calculators, data import, and an AI advisor.
- **Authentication:** account access with bearer-token authentication and refresh-token support.

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
