import os
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ENV_FILE = os.path.join(PROJECT_ROOT, ".env")
DEFAULT_SECRET_KEY = "finverse-super-secret-production-key-2026-x89b-change-in-env"

class Settings(BaseSettings):
    APP_NAME: str = "Finverse Personal Finance & Wealth Tracker"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Security / JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30")) # 30 days
    
    # Database - Direct PostgreSQL
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "root")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "finance_tracker")
    
    # Connection String
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        
    # Pool Settings
    PG_MIN_POOL_SIZE: int = int(os.getenv("PG_MIN_POOL_SIZE", "1"))
    PG_MAX_POOL_SIZE: int = int(os.getenv("PG_MAX_POOL_SIZE", "5"))

    # Vertex AI Gemini. ADC is used locally and the Cloud Run service account in production.
    GEMINI_ENABLED: bool = True
    GEMINI_PROJECT: str = "finance-tracker-app-512203"
    GEMINI_LOCATION: str = "global"
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_TEMPERATURE: float = 0.3
    GEMINI_MAX_OUTPUT_TOKENS: int = 4000
    # Multimodal statement parsing is user opt-in and bounded independently from chat.
    IMPORT_GEMINI_ENABLED: bool = True
    IMPORT_GEMINI_MAX_PAGES: int = 20
    IMPORT_GEMINI_MAX_ROWS: int = 1000
    IMPORT_GEMINI_MAX_OUTPUT_TOKENS: int = 12000
    AI_GUARDRAILS_FILE: str = os.path.join(os.path.dirname(__file__), "..", "data", "ai_guardrails.json")
    AI_DAILY_REQUEST_LIMIT: int = 30
    AI_QUOTA_TIMEZONE: str = "Asia/Kolkata"
    AI_BURST_REQUESTS_PER_MINUTE: int = 5
    AI_BURST_WINDOW_SECONDS: int = 60

    @field_validator("GEMINI_PROJECT", mode="before")
    @classmethod
    def default_vertex_project(cls, value: str | None) -> str:
        return value.strip() if isinstance(value, str) and value.strip() else "finance-tracker-app-512203"

    @field_validator(
        "AI_DAILY_REQUEST_LIMIT", "AI_BURST_REQUESTS_PER_MINUTE", "AI_BURST_WINDOW_SECONDS",
        "IMPORT_GEMINI_MAX_PAGES", "IMPORT_GEMINI_MAX_ROWS", "IMPORT_GEMINI_MAX_OUTPUT_TOKENS",
    )
    @classmethod
    def validate_positive_ai_limits(cls, value: int) -> int:
        if value < 1:
            raise ValueError("AI request limits must be positive integers.")
        return value

    @field_validator("AI_QUOTA_TIMEZONE")
    @classmethod
    def validate_ai_quota_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, TypeError):
            raise ValueError("AI_QUOTA_TIMEZONE must be a valid IANA timezone, such as Asia/Kolkata.")
        return value

    # CORS
   
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = (
        [
            "https://finance-tracker-app-512203.web.app",
            "https://finance-tracker-app-512203.firebaseapp.com",
        ]
        if os.getenv("ENVIRONMENT", "development").lower() in {"production", "prod"}
        else [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "https://finance-tracker-app-512203.web.app",
            "https://finance-tracker-app-512203.firebaseapp.com",
        ]
    )


    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.ENVIRONMENT.lower() in {"production", "prod"}:
            if (
                self.SECRET_KEY == DEFAULT_SECRET_KEY
                or len(self.SECRET_KEY) < 32
                or self.SECRET_KEY.lower().startswith(("replace-", "change-me"))
            ):
                raise ValueError(
                    "Production requires a unique SECRET_KEY with at least 32 characters."
                )
            if "*" in self.BACKEND_CORS_ORIGINS:
                raise ValueError(
                    "Production BACKEND_CORS_ORIGINS must list trusted frontend origins; "
                    "wildcard origins are not allowed."
                )
            if not self.BACKEND_CORS_ORIGINS or any(
                origin.lower().startswith(
                    ("http://localhost", "http://127.0.0.1")
                )
                for origin in self.BACKEND_CORS_ORIGINS
            ):
                raise ValueError(
                    "Production BACKEND_CORS_ORIGINS must contain the deployed "
                    "frontend origin, not local development origins."
                )
        return self

    class Config:
        env_file = ENV_FILE
        extra = "ignore"

settings = Settings()
