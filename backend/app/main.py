import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import (
    check_db_connection,
    close_db_pool,
    init_db_pool,
    run_schema_migration,
)
from app.routers import (
    auth,
    categories,
    budgets,
    accounts,
    transactions,
    assets,
    liabilities,
    essentials,
    calculators,
    import_data,
    ai_insights,
    goals,
    debts,
    insurance_policies,
    financial_profiles,
    recommendations
)

logger = logging.getLogger("finverse.main")
logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Starting up Finverse backend application...")
    try:
        init_db_pool()
        run_schema_migration()
        yield
    finally:
        logger.info("Shutting down Finverse backend application...")
        close_db_pool()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Comprehensive Personal Finance, Wealth & Essentials Tracker API with AI Advisory",
    lifespan=lifespan
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(categories.router, prefix=settings.API_V1_STR)
app.include_router(budgets.router, prefix=settings.API_V1_STR)
app.include_router(accounts.router, prefix=settings.API_V1_STR)
app.include_router(transactions.router, prefix=settings.API_V1_STR)
app.include_router(assets.router, prefix=settings.API_V1_STR)
app.include_router(liabilities.router, prefix=settings.API_V1_STR)
app.include_router(essentials.router, prefix=settings.API_V1_STR)
app.include_router(calculators.router, prefix=settings.API_V1_STR)
app.include_router(import_data.router, prefix=settings.API_V1_STR)
app.include_router(ai_insights.router, prefix=settings.API_V1_STR)
# Phase 2 Routers
app.include_router(goals.router, prefix=settings.API_V1_STR)
app.include_router(debts.router, prefix=settings.API_V1_STR)
app.include_router(insurance_policies.router, prefix=settings.API_V1_STR)
app.include_router(financial_profiles.router, prefix=settings.API_V1_STR)
app.include_router(recommendations.router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def health_check():
    if not check_db_connection():
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "app": settings.APP_NAME,
                "database": "PostgreSQL unavailable",
                "message": "The PostgreSQL database could not be reached.",
                "environment": settings.ENVIRONMENT,
            },
        )
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "database": "PostgreSQL",
        "environment": settings.ENVIRONMENT
    }

@app.get("/")
def root():
    return {
        "message": "Welcome to Finverse Personal Finance & Wealth Tracker API",
        "docs": "/docs",
        "health": "/api/health"
    }
