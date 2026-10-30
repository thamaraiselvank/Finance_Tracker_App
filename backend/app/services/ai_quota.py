from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.core.config import settings
from app.core.database import execute_returning, fetch_one


def _quota_day(now: datetime | None = None) -> tuple[date, datetime]:
    zone = ZoneInfo(settings.AI_QUOTA_TIMEZONE)
    local_now = (now or datetime.now(timezone.utc)).astimezone(zone)
    next_midnight = datetime.combine(local_now.date() + timedelta(days=1), time.min, tzinfo=zone)
    return local_now.date(), next_midnight.astimezone(timezone.utc)


def get_daily_quota(user_id: str) -> dict:
    usage_date, reset_at = _quota_day()
    row = fetch_one(
        """SELECT requests_used FROM ai_daily_usage
           WHERE user_id = %s AND usage_date = %s""",
        (user_id, usage_date),
    )
    used = int(row["requests_used"]) if row else 0
    limit = settings.AI_DAILY_REQUEST_LIMIT
    return {
        "limit": limit,
        "used": used,
        "remaining": max(0, limit - used),
        "resets_at": reset_at.isoformat(),
        "timezone": settings.AI_QUOTA_TIMEZONE,
    }


def reserve_daily_request(user_id: str) -> date:
    usage_date, _ = _quota_day()
    reservation = execute_returning(
        """INSERT INTO ai_daily_usage (user_id, usage_date, requests_used)
           VALUES (%s, %s, 1)
           ON CONFLICT (user_id, usage_date) DO UPDATE
           SET requests_used = ai_daily_usage.requests_used + 1,
               updated_at = NOW()
           WHERE ai_daily_usage.requests_used < %s
           RETURNING requests_used""",
        (user_id, usage_date, settings.AI_DAILY_REQUEST_LIMIT),
    )
    if reservation:
        return usage_date

    quota = get_daily_quota(user_id)
    raise HTTPException(
        status_code=429,
        detail={
            "code": "daily_limit_reached",
            "message": "You’ve used all your AI questions for today.",
            "quota": quota,
        },
    )


def release_daily_request(user_id: str, usage_date: date) -> None:
    execute_returning(
        """UPDATE ai_daily_usage
           SET requests_used = GREATEST(requests_used - 1, 0), updated_at = NOW()
           WHERE user_id = %s AND usage_date = %s
           RETURNING requests_used""",
        (user_id, usage_date),
    )


def enforce_burst_limit(user_id: str) -> None:
    window_seconds = settings.AI_BURST_WINDOW_SECONDS
    row = execute_returning(
        """INSERT INTO ai_chat_rate_limits (user_id, window_start, request_count)
           VALUES (%s, NOW(), 1)
           ON CONFLICT (user_id) DO UPDATE SET
             window_start = CASE
               WHEN ai_chat_rate_limits.window_start + (%s * INTERVAL '1 second') <= NOW()
               THEN NOW() ELSE ai_chat_rate_limits.window_start END,
             request_count = CASE
               WHEN ai_chat_rate_limits.window_start + (%s * INTERVAL '1 second') <= NOW()
               THEN 1 ELSE ai_chat_rate_limits.request_count + 1 END,
             updated_at = NOW()
           WHERE ai_chat_rate_limits.window_start + (%s * INTERVAL '1 second') <= NOW()
              OR ai_chat_rate_limits.request_count < %s
           RETURNING request_count""",
        (
            user_id,
            window_seconds,
            window_seconds,
            window_seconds,
            settings.AI_BURST_REQUESTS_PER_MINUTE,
        ),
    )
    if row:
        return

    wait = fetch_one(
        """SELECT GREATEST(1, CEIL(EXTRACT(EPOCH FROM
           (window_start + (%s * INTERVAL '1 second') - NOW())))::integer) AS retry_after
           FROM ai_chat_rate_limits WHERE user_id = %s""",
        (window_seconds, user_id),
    )
    retry_after = int(wait["retry_after"]) if wait else window_seconds
    raise HTTPException(
        status_code=429,
        detail={
            "code": "chat_rate_limited",
            "message": "You’re sending messages too quickly. Please wait a moment and try again.",
            "retry_after_seconds": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )
