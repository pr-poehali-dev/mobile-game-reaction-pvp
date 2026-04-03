"""
Push Scheduler для игры НЕ СЛОМАЙСЯ.
Отправляет Web Push уведомления по триггерам:
- near_miss: < 50мс разницы → через 20-30 мин
- streak_lost >= 3 → через 1-2 часа
- close_to_league_up: до след. лиги < 50 рейтинга → через 1-3 часа
- inactive: не заходил > 24ч → 1 раз в день
- Вызывается через GET ?action=run (cron или вручную)
- Вызывается через POST ?action=send_one (для одиночной отправки после матча)
"""
import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67729910_mobile_game_reaction")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Player-Id",
}

LEAGUES = [
    {"id": "bronze",  "name": "Бронза",  "min": 0,    "max": 999},
    {"id": "silver",  "name": "Серебро", "min": 1000, "max": 1399},
    {"id": "gold",    "name": "Золото",  "min": 1400, "max": 1799},
    {"id": "plat",    "name": "Платина", "min": 1800, "max": 2199},
    {"id": "legend",  "name": "Легенда", "min": 2200, "max": 999999},
]

def get_next_league(rating: int) -> dict | None:
    for lg in LEAGUES:
        if lg["min"] > rating:
            return lg
    return None

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }

def send_web_push(subscription_json: str, title: str, body_text: str, data: dict = None) -> bool:
    """Отправляет Web Push через FCM Legacy HTTP API."""
    fcm_key = os.environ.get("FCM_SERVER_KEY", "")
    if not fcm_key:
        return False

    try:
        sub = json.loads(subscription_json) if isinstance(subscription_json, str) else subscription_json
    except Exception:
        return False

    # Если токен — FCM registration token (строка, не JSON-объект subscription)
    if isinstance(sub, str):
        token = sub
    elif isinstance(sub, dict) and "endpoint" in sub:
        # Стандартный PushSubscription — пока не поддерживаем без web-push библиотеки
        return False
    else:
        token = sub.get("token", "")

    if not token:
        return False

    payload = {
        "to": token,
        "notification": {
            "title": title,
            "body": body_text,
            "icon": "/icon-192.png",
            "badge": "/icon-96.png",
            "sound": "default",
        },
        "data": data or {"action": "start_game"},
        "priority": "high",
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://fcm.googleapis.com/fcm/send",
        data=req_data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"key={fcm_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status == 200
    except urllib.error.HTTPError:
        return False
    except Exception:
        return False


def build_push_for_player(player: dict) -> tuple[str, str, dict] | None:
    """
    Определяет триггер и возвращает (title, body, data) или None если пуш не нужен.
    Порядок приоритетов: near_miss → streak → league → inactive.
    """
    now = datetime.now(timezone.utc)

    # Лимит: 2 пуша в день
    reset_date = player.get("push_reset_date")
    count_today = player.get("push_count_today") or 0
    if reset_date and reset_date == now.date() and count_today >= 2:
        return None

    last_played = player.get("last_played_at")
    if last_played and isinstance(last_played, datetime):
        elapsed = (now - last_played).total_seconds() / 60  # минуты

        last_result = player.get("last_result", "")
        near_miss_diff = player.get("near_miss_diff")
        streak = player.get("streak", 0)
        rating = player.get("rating", 1000)

        # 1. Near miss < 50мс → через 20-30 мин
        if (last_result == "lose" and near_miss_diff is not None
                and near_miss_diff < 50 and 20 <= elapsed <= 120):
            ms = near_miss_diff
            if ms < 5:
                title = f"0.00{ms} сек… ты был очень близко"
            else:
                title = f"0.0{ms // 10} сек… ты был очень близко"
            return (
                title,
                "Попробуешь ещё раз? Один матч.",
                {"action": "start_game", "trigger": "near_miss"}
            )

        # 2. Потеря серии >= 3 → через 1-3 часа
        if (last_result == "lose" and streak == 0
                and player.get("max_streak", 0) >= 3
                and 60 <= elapsed <= 300):
            prev_streak = player.get("max_streak", 3)
            return (
                f"Серия прервана",
                f"Ты был в шаге от {prev_streak + 1} побед подряд. Вернись.",
                {"action": "start_game", "trigger": "streak_lost"}
            )

        # 3. Близко к апу лиги → через 1-3 часа
        next_lg = get_next_league(rating)
        if next_lg and 60 <= elapsed <= 360:
            points_left = next_lg["min"] - rating
            if 0 < points_left <= 50:
                return (
                    f"Ещё {points_left} рейтинга до {next_lg['name']}",
                    "Одна победа — и ты поднимаешься.",
                    {"action": "start_game", "trigger": "league_up"}
                )

    # 4. Не заходил > 24 часа
    if last_played:
        hours_away = (now - last_played).total_seconds() / 3600
        if 24 <= hours_away <= 48:
            return (
                "Сможешь выдержать сегодня?",
                "Твои соперники уже тренируются.",
                {"action": "start_game", "trigger": "inactive"}
            )

    return None


def handler(event: dict, context) -> dict:
    """Планировщик push-уведомлений. GET ?action=run — массовая рассылка, POST ?action=send_one — одиночная."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "run")

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    # ── POST /send_one — после матча, для конкретного игрока с задержкой ──
    if method == "POST" and action == "send_one":
        player_id = body.get("player_id")
        if not player_id:
            return resp(400, {"error": "player_id required"})

        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(f"SELECT * FROM {SCHEMA}.players WHERE id = %s", (player_id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return resp(404, {"error": "player not found"})

        player = dict(row)
        if not player.get("push_token"):
            cur.close(); conn.close()
            return resp(200, {"ok": False, "reason": "no_token"})

        push = build_push_for_player(player)
        if not push:
            cur.close(); conn.close()
            return resp(200, {"ok": False, "reason": "no_trigger"})

        title, body_text, data = push
        sent = send_web_push(player["push_token"], title, body_text, data)

        if sent:
            now = datetime.now(timezone.utc)
            today = now.date()
            new_count = (player.get("push_count_today") or 0) + 1
            cur.execute(
                f"UPDATE {SCHEMA}.players SET push_sent_at=NOW(), push_count_today=%s, push_reset_date=%s WHERE id=%s",
                (new_count, today, player_id)
            )
            conn.commit()

        cur.close(); conn.close()
        return resp(200, {"ok": sent, "trigger": data.get("trigger")})

    # ── GET /run — массовая рассылка (cron) ──
    if action == "run":
        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Игроки с токеном, которые играли в последние 48ч
        cur.execute(
            f"""SELECT * FROM {SCHEMA}.players
                WHERE push_token IS NOT NULL
                  AND last_played_at > NOW() - INTERVAL '48 hours'"""
        )
        players = [dict(r) for r in cur.fetchall()]

        sent_count = 0
        skipped = 0
        now = datetime.now(timezone.utc)
        today = now.date()

        for player in players:
            push = build_push_for_player(player)
            if not push:
                skipped += 1
                continue

            title, body_text, data = push
            ok = send_web_push(player["push_token"], title, body_text, data)

            if ok:
                new_count = (player.get("push_count_today") or 0) + 1
                cur.execute(
                    f"UPDATE {SCHEMA}.players SET push_sent_at=NOW(), push_count_today=%s, push_reset_date=%s WHERE id=%s",
                    (new_count, today, player["id"])
                )
                sent_count += 1

        conn.commit()
        cur.close()
        conn.close()

        return resp(200, {
            "ok": True,
            "sent": sent_count,
            "skipped": skipped,
            "total": len(players),
        })

    return resp(404, {"error": "unknown action"})
