from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
import datetime

class AssetBase(BaseModel):
    name: str
    asset_class: str = Field(..., description="EQUITY, MUTUAL_FUND, COMMODITY_GOLD, REAL_ESTATE, CASH_EQUIVALENT, FIXED_INCOME, CRYPTO, OTHER")
    sub_type: Optional[str] = None
    invested_amount: float = Field(0.0, ge=0)
    current_value: float = Field(..., ge=0)
    quantity: Optional[float] = Field(1.0, ge=0)
    buy_price: Optional[float] = Field(0.0, ge=0)
    current_price: Optional[float] = Field(0.0, ge=0)
    purchase_date: Optional[datetime.date] = None
    notes: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = {}

class AssetCreate(AssetBase):
    pass

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    asset_class: Optional[str] = None
    sub_type: Optional[str] = None
    invested_amount: Optional[float] = Field(None, ge=0)
    current_value: Optional[float] = Field(None, ge=0)
    quantity: Optional[float] = Field(None, ge=0)
    buy_price: Optional[float] = Field(None, ge=0)
    current_price: Optional[float] = Field(None, ge=0)
    purchase_date: Optional[datetime.date] = None
    notes: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None

class AssetOut(AssetBase):
    id: UUID | str
    user_id: UUID | str
    pnl: float = 0.0
    pnl_percentage: float = 0.0
    price_updated_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

class AssetClassSummary(BaseModel):
    asset_class: str
    total_invested: float = 0.0
    total_current_value: float = 0.0
    total_pnl: float = 0.0
    pnl_percentage: float = 0.0
    allocation_percentage: float = 0.0
    count: int = 0
    items: List[AssetOut] = []

class WealthSummary(BaseModel):
    total_assets_invested: float = 0.0
    total_assets_current: float = 0.0
    total_assets_pnl: float = 0.0
    total_assets_pnl_pct: float = 0.0
    total_liabilities_outstanding: float = 0.0
    total_monthly_emi: float = 0.0
    net_worth: float = 0.0
    asset_classes: List[AssetClassSummary] = []
