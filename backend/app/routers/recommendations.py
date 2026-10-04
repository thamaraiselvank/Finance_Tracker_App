from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional

from app.core.database import fetch_all, fetch_one, execute_query, execute_returning
from app.core.security import get_current_user_id
from app.schemas.recommendation import (
    RecommendationBase,
    RecommendationOut,
    RecommendationSummary,
    AIInsight,
)
from app.services.recommendation_engine import generate_ai_insights

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/", response_model=List[RecommendationOut])
def list_recommendations(user_id: str = Depends(get_current_user_id)):
    """Get all recommendations for the current user."""
    try:
        rows = fetch_all(
            """
            SELECT id, user_id, recommendation_type, title, description, urgency,
                   potential_savings, status, action_url, metadata, created_at, updated_at
            FROM recommendations
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,),
        )
        return rows or []
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/", response_model=RecommendationOut)
def create_recommendation(
    payload: RecommendationBase,
    user_id: str = Depends(get_current_user_id),
):
    """Create a new recommendation."""
    try:
        row = execute_returning(
            """
            INSERT INTO recommendations (
                user_id, recommendation_type, title, description, urgency,
                potential_savings, status, action_url, metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'ACTIVE', NULL, NULL)
            RETURNING id, user_id, recommendation_type, title, description, urgency,
                      potential_savings, status, action_url, metadata, created_at, updated_at
            """,
            (
                user_id,
                payload.recommendation_type,
                payload.title,
                payload.description,
                payload.urgency,
                payload.impact_timeframe or 0,
            ),
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create recommendation")
        return row
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get("/{recommendation_id}", response_model=RecommendationOut)
def get_recommendation(recommendation_id: str, user_id: str = Depends(get_current_user_id)):
    """Get a specific recommendation by id."""
    try:
        row = fetch_one(
            """
            SELECT id, user_id, recommendation_type, title, description, urgency,
                   potential_savings, status, action_url, metadata, created_at, updated_at
            FROM recommendations
            WHERE id = %s AND user_id = %s
            """,
            (recommendation_id, user_id),
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")
        return row
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.put("/{recommendation_id}", response_model=RecommendationOut)
def update_recommendation(
    recommendation_id: str,
    status_value: str = "ACKNOWLEDGED",
    user_id: str = Depends(get_current_user_id),
):
    """Update recommendation status."""
    try:
        row = execute_returning(
            """
            UPDATE recommendations
            SET status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND user_id = %s
            RETURNING id, user_id, recommendation_type, title, description, urgency,
                      potential_savings, status, action_url, metadata, created_at, updated_at
            """,
            (status_value, recommendation_id, user_id),
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")
        return row
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get("/summary/overview", response_model=RecommendationSummary)
def get_recommendations_summary(user_id: str = Depends(get_current_user_id)):
    """Get a summary of recommendations for the current user."""
    try:
        rows = fetch_all(
            """
            SELECT id, user_id, recommendation_type, title, description, urgency,
                   potential_savings, status, action_url, metadata, created_at, updated_at
            FROM recommendations
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,),
        )

        with_urgency = {
            "CRITICAL": 0,
            "HIGH": 0,
            "MEDIUM": 0,
            "LOW": 0,
        }
        for row in rows:
            urgency = str(row.get("urgency", "MEDIUM")).upper()
            with_urgency[urgency] = with_urgency.get(urgency, 0) + 1

        summary = RecommendationSummary(
            total_recommendations=len(rows),
            critical_recommendations=with_urgency.get("CRITICAL", 0),
            high_recommendations=with_urgency.get("HIGH", 0),
            total_potential_savings=sum(float(r.get("potential_savings", 0) or 0) for r in rows),
            top_recommendations=rows[:5],
            completed_recommendations=sum(1 for r in rows if str(r.get("status", "ACTIVE")).upper() == "COMPLETED"),
        )
        return summary
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/generate-insights", response_model=List[AIInsight])
def generate_insights(user_id: str = Depends(get_current_user_id)):
    """Generate AI insights for the current user."""
    try:
        insights = generate_ai_insights(user_id=user_id)
        return insights
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
