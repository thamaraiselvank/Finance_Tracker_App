from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
import datetime

class MilestoneBase(BaseModel):
    milestone_name: str = Field(..., min_length=1, max_length=255)
    milestone_type: str = Field(..., description="EMERGENCY_FUND, DEBT_FREE, NET_WORTH, INVESTMENT_GOAL, SAVINGS_STREAK, BUDGET_SUCCESS, INSURANCE_COMPLETE, OTHER")
    description: Optional[str] = None
    target_value: Optional[float] = None

class MilestoneCreate(MilestoneBase):
    pass

class MilestoneOut(MilestoneBase):
    id: UUID | str
    user_id: UUID | str
    achieved_value: Optional[float] = None
    achieved_date: Optional[datetime.date] = None
    is_achieved: bool = False
    celebration_message: Optional[str] = None
    created_at: Optional[datetime.datetime] = None

class MilestoneAchievement(BaseModel):
    milestone_id: UUID | str
    milestone_name: str
    milestone_type: str
    achieved_date: datetime.date
    target_value: Optional[float] = None
    achieved_value: Optional[float] = None
    celebration_message: str
    badge_icon: str
    sharing_message: Optional[str] = None

class AchievementBadge(BaseModel):
    badge_name: str
    badge_type: str
    description: str
    icon_emoji: str
    unlock_condition: str
    date_unlocked: Optional[datetime.date] = None
    rarity: str  # Common, Rare, Epic, Legendary

class SavingsStreak(BaseModel):
    current_streak_days: int
    longest_streak_days: int
    last_streak_date: datetime.date
    next_milestone_days: int
    streak_reward: Optional[str] = None

class MilestoneProgress(BaseModel):
    milestone_name: str
    progress_percentage: float
    days_until_target: Optional[int] = None
    on_track: bool
    trend: str  # Improving, Stable, Declining
    estimated_completion_date: Optional[datetime.date] = None

class GamificationSummary(BaseModel):
    total_badges_earned: int
    total_badges_available: int
    current_streak_days: int
    longest_streak_days: int
    milestones_achieved: int
    total_milestones: int
    overall_achievement_percentage: float
    next_achievement_tips: list[str] = []
