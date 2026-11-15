from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from uuid import UUID
from app.core.database import fetch_one, fetch_all, execute_returning, execute_query
from app.core.security import get_current_user_id
from app.schemas.goal import (
    GoalCreate, GoalUpdate, GoalOut, GoalProgressSummary, GoalWithProjection,
    GoalContributionCreate,
)
from datetime import datetime, date
from math import ceil
import logging

logger = logging.getLogger("finverse.goals")

router = APIRouter(prefix="/goals", tags=["Goals"])

@router.post("/", response_model=GoalOut)
def create_goal(payload: GoalCreate, user_id: str = Depends(get_current_user_id)):
    """Create a new financial goal"""
    try:
        if payload.current_amount > payload.target_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already saved amount cannot exceed the target amount.",
            )

        # Calculate suggested monthly savings
        days_to_target = (payload.target_date - date.today()).days
        months_to_target = max(ceil(days_to_target / 30), 1)
        remaining_amount = payload.target_amount - payload.current_amount
        suggested_monthly = remaining_amount / months_to_target
        
        goal = execute_returning("""
                INSERT INTO goals (user_id, goal_name, goal_type, target_amount, current_amount, target_date,
                         priority, description, suggested_monthly_savings, allocated_monthly_savings,
                         progress_percentage)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    CASE
                        WHEN %s > 0 AND (%s / %s) * 100 > 100 THEN 100
                        WHEN %s > 0 THEN (%s / %s) * 100
                        ELSE 0
                    END)
            RETURNING id, user_id, goal_name, goal_type, target_amount, current_amount, 
                     target_date, priority, description, status, suggested_monthly_savings, 
                     allocated_monthly_savings, progress_percentage, created_at, updated_at
        """, (
            user_id, payload.goal_name, payload.goal_type, payload.target_amount,
            payload.current_amount, payload.target_date, payload.priority, payload.description,
            suggested_monthly, payload.allocated_monthly_savings or 0,
            payload.target_amount, payload.current_amount, payload.target_amount,
            payload.target_amount, payload.current_amount, payload.target_amount
        ))
        
        logger.info(f"Goal created: {goal.get('id')} for user {user_id}")
        return goal
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating goal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create goal. Please verify the goal details and try again.",
        )

@router.get("/", response_model=List[GoalOut])
def list_goals(status_filter: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """Get all goals for user"""
    try:
        if status_filter:
            goals = fetch_all("""
                SELECT g.id, g.user_id, g.goal_name, g.goal_type, g.target_amount, g.current_amount,
                       g.target_date, g.priority, g.description, g.status, g.suggested_monthly_savings,
                       g.allocated_monthly_savings, g.progress_percentage, g.created_at, g.updated_at,
                       COALESCE((SELECT SUM(gc.amount) FROM goal_contributions gc WHERE gc.goal_id = g.id
                         AND gc.contributed_at >= date_trunc('month', CURRENT_DATE)
                         AND gc.contributed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'), 0) AS month_contributed
                FROM goals g WHERE g.user_id = %s AND g.status = %s
                ORDER BY g.priority ASC, g.target_date ASC
            """, (user_id, status_filter))
        else:
            goals = fetch_all("""
                SELECT g.id, g.user_id, g.goal_name, g.goal_type, g.target_amount, g.current_amount,
                       g.target_date, g.priority, g.description, g.status, g.suggested_monthly_savings,
                       g.allocated_monthly_savings, g.progress_percentage, g.created_at, g.updated_at,
                       COALESCE((SELECT SUM(gc.amount) FROM goal_contributions gc WHERE gc.goal_id = g.id
                         AND gc.contributed_at >= date_trunc('month', CURRENT_DATE)
                         AND gc.contributed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'), 0) AS month_contributed
                FROM goals g WHERE g.user_id = %s
                ORDER BY g.priority ASC, g.target_date ASC
            """, (user_id,))
        return goals or []
    except Exception as e:
        logger.error(f"Error fetching goals: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{goal_id}/contributions", response_model=GoalOut)
def add_goal_contribution(goal_id: str, payload: GoalContributionCreate, user_id: str = Depends(get_current_user_id)):
    """Record a contribution and immediately update the saved balance."""
    try:
        goal = fetch_one("SELECT id, target_amount, current_amount, status FROM goals WHERE id = %s AND user_id = %s", (goal_id, user_id))
        if not goal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
        if goal.get("status") != "ACTIVE":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only active goals can receive contributions.")
        updated = execute_returning("""WITH contribution AS (
            INSERT INTO goal_contributions (goal_id, user_id, amount) VALUES (%s, %s, %s)
            RETURNING amount
        )
        UPDATE goals SET current_amount = current_amount + (SELECT amount FROM contribution),
            progress_percentage = LEAST(((current_amount + (SELECT amount FROM contribution)) / NULLIF(target_amount, 0)) * 100, 100),
            status = CASE WHEN current_amount + (SELECT amount FROM contribution) >= target_amount THEN 'COMPLETED' ELSE status END,
            updated_at = CURRENT_TIMESTAMP WHERE id = %s AND user_id = %s
            RETURNING id, user_id, goal_name, goal_type, target_amount, current_amount, target_date,
              priority, description, status, suggested_monthly_savings, allocated_monthly_savings,
              progress_percentage, created_at, updated_at""",
            (goal_id, user_id, payload.amount, goal_id, user_id),
        )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording goal contribution: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not record this contribution.")

@router.get("/summary/progress", response_model=GoalProgressSummary)
def get_goals_progress(user_id: str = Depends(get_current_user_id)):
    """Get summary of all goals progress"""
    try:
        summary = fetch_one("""
            SELECT
                COUNT(*) as total_goals,
                COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) as completed_goals,
                COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END), 0) as active_goals,
                COALESCE(SUM(target_amount), 0) as total_target_amount,
                COALESCE(SUM(current_amount), 0) as total_current_amount,
                COALESCE(SUM(allocated_monthly_savings), 0) as total_monthly_allocation
            FROM goals WHERE user_id = %s
        """, (user_id,))

        return summary or {
            'total_goals': 0,
            'completed_goals': 0,
            'active_goals': 0,
            'total_target_amount': 0.0,
            'total_current_amount': 0.0,
            'total_monthly_allocation': 0.0
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching goals progress: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{goal_id}", response_model=GoalWithProjection)
def get_goal(goal_id: str, user_id: str = Depends(get_current_user_id)):
    """Get specific goal with projection"""
    try:
        goal = fetch_one("""
            SELECT id, user_id, goal_name, goal_type, target_amount, current_amount,
                   target_date, priority, description, status, suggested_monthly_savings,
                   allocated_monthly_savings, progress_percentage, created_at, updated_at
            FROM goals WHERE id = %s AND user_id = %s
        """, (goal_id, user_id))
        
        if not goal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
        
        # Calculate projection
        remaining = goal.get('target_amount', 0) - goal.get('current_amount', 0)
        monthly_saving = goal.get('allocated_monthly_savings', 0) or goal.get('suggested_monthly_savings', 0)
        months_needed = remaining / monthly_saving if monthly_saving > 0 else 0
        
        goal['months_to_completion'] = int(months_needed)
        goal['on_track'] = months_needed <= ((goal.get('target_date') - date.today()).days // 30) if goal.get('target_date') else True
        
        return goal
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching goal: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: str, payload: GoalUpdate, user_id: str = Depends(get_current_user_id)):
    """Update a goal"""
    try:
        # Check ownership
        existing = fetch_one(
            "SELECT user_id, target_amount, current_amount FROM goals WHERE id = %s",
            (goal_id,)
        )
        if not existing or str(existing.get('user_id')) != str(user_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
        # Build update query
        updates = []
        params = []
        
        for field in ['goal_name', 'goal_type', 'target_amount', 'target_date', 'priority', 
                     'description', 'status', 'allocated_monthly_savings', 'current_amount']:
            if getattr(payload, field, None) is not None:
                updates.append(f"{field} = %s")
                params.append(getattr(payload, field))

        updated_target = payload.target_amount if payload.target_amount is not None else existing.get('target_amount', 0)
        updated_current = payload.current_amount if payload.current_amount is not None else existing.get('current_amount', 0)
        progress_percentage = min((updated_current / updated_target) * 100, 100) if updated_target > 0 else 0
        updates.append("progress_percentage = %s")
        params.append(progress_percentage)
        
        params.append(goal_id)
        params.append(user_id)
        
        updated = execute_returning(f"""
            UPDATE goals SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND user_id = %s
            RETURNING id, user_id, goal_name, goal_type, target_amount, current_amount,
                     target_date, priority, description, status, suggested_monthly_savings,
                     allocated_monthly_savings, progress_percentage, created_at, updated_at
        """, params)
        
        logger.info(f"Goal updated: {goal_id}")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating goal: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a goal"""
    try:
        deleted = execute_query("DELETE FROM goals WHERE id = %s AND user_id = %s", (goal_id, user_id))
        if deleted == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
        logger.info(f"Goal deleted: {goal_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting goal: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
