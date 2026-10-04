import os
from pydantic_settings import BaseSettings
from typing import Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ENV_FILE = os.path.join(PROJECT_ROOT, ".env")

class Settings(BaseSettings):
    APP_NAME: str = "Finverse Personal Finance & Wealth Tracker"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Security / JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "finverse-super-secret-production-key-2026-x89b-change-in-env")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")) # 1 hour
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
    PG_MIN_POOL_SIZE: int = int(os.getenv("PG_MIN_POOL_SIZE", "2"))
    PG_MAX_POOL_SIZE: int = int(os.getenv("PG_MAX_POOL_SIZE", "15"))

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

    class Config:
        env_file = ENV_FILE
        extra = "ignore"

settings = Settings()
