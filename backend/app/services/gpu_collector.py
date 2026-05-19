import asyncio
import sqlite3
import time
from pathlib import Path
from typing import Dict, List, Any
from app.core.config import settings
from app.services.bcm_client import bcm_client

_backend_dir = Path(__file__).parent.parent.parent
DB_PATH = _backend_dir / settings.GPU_DB_PATH
SEVEN_DAYS = 7 * 24 * 3600

_UTIL_METRICS = (
    [f"gpu_utilization:gpu{i}" for i in range(8)] +
    [f"gpu_mem_utilization:gpu{i}" for i in range(8)] +
    ["gpu_utilization:average", "gpu_mem_utilization:average"]
)
_OTHER_METRICS = [
    "gpu_temperature:average",
    "gpu_power_usage:total",
]
_ALL_METRICS = set(_UTIL_METRICS + _OTHER_METRICS)
_UTIL_SET = set(_UTIL_METRICS)


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS gpu_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity TEXT NOT NULL,
                measurable TEXT NOT NULL,
                value REAL,
                ts INTEGER NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_emt ON gpu_metrics(entity, measurable, ts)"
        )
        conn.commit()


def _to_float(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _store(rows: List[tuple]):
    cutoff = int(time.time()) - SEVEN_DAYS
    with sqlite3.connect(DB_PATH) as conn:
        conn.executemany(
            "INSERT INTO gpu_metrics (entity, measurable, value, ts) VALUES (?,?,?,?)",
            rows,
        )
        conn.execute("DELETE FROM gpu_metrics WHERE ts < ?", (cutoff,))
        conn.commit()


async def collect_once():
    nodes = await bcm_client.get_gpu_nodes()
    now = int(time.time())
    rows: List[tuple] = []

    for entity in nodes:
        data = await bcm_client.get_latest(entity=entity)
        metric_map = {d['measurable']: d['raw'] for d in data}
        for m in _ALL_METRICS:
            raw = metric_map.get(m)
            v = _to_float(raw)
            if v is None:
                continue
            # normalise utilisation 0-1 → 0-100
            if m in _UTIL_SET and v <= 1.0:
                v = round(v * 100, 2)
            rows.append((entity, m, v, now))

    if rows:
        _store(rows)


def query_history(entity: str, metric_prefix: str, hours: int) -> Dict[str, List]:
    cutoff = int(time.time()) - hours * 3600

    if hours <= 1:
        bucket = 60
    elif hours <= 6:
        bucket = 300
    elif hours <= 24:
        bucket = 900
    else:
        bucket = 3600

    def _fetch(pattern: str):
        with sqlite3.connect(DB_PATH) as conn:
            return conn.execute("""
                SELECT measurable,
                       CAST(ts / ? AS INTEGER) * ? AS bucket,
                       AVG(value)
                FROM gpu_metrics
                WHERE entity = ?
                  AND measurable LIKE ?
                  AND ts >= ?
                GROUP BY measurable, bucket
                ORDER BY bucket ASC
            """, (bucket, bucket, entity, pattern, cutoff)).fetchall()

    rows = _fetch(f"{metric_prefix}:gpu%")
    if not rows:
        rows = _fetch(f"{metric_prefix}:%")

    series: Dict[str, List] = {}
    for measurable, bucket_ts, value in rows:
        label = measurable.split(':')[-1]
        if label not in series:
            series[label] = []
        series[label].append([bucket_ts * 1000, round(value, 2)])

    return series


def query_summary(nodes: List[str]) -> Dict:
    """Compute cluster summary from our SQLite data — consistent with per-node display."""
    cutoff = int(time.time()) - 300  # "up" = data within last 5 min

    total_gpus = 0
    gpus_up = 0
    util_pcts: list[float] = []
    mem_pcts: list[float] = []
    power_total = 0.0

    want = ("gpu_utilization:average", "gpu_mem_utilization:average", "gpu_power_usage:total")

    for entity in nodes:
        with sqlite3.connect(DB_PATH) as conn:
            gpu_slots = conn.execute(
                "SELECT COUNT(DISTINCT measurable) FROM gpu_metrics "
                "WHERE entity=? AND measurable LIKE 'gpu_utilization:gpu%'",
                (entity,),
            ).fetchone()[0]
            gpu_recent = conn.execute(
                "SELECT COUNT(DISTINCT measurable) FROM gpu_metrics "
                "WHERE entity=? AND measurable LIKE 'gpu_utilization:gpu%' AND ts>=?",
                (entity, cutoff),
            ).fetchone()[0]
            total_gpus += gpu_slots
            gpus_up += gpu_recent

            rows = conn.execute(
                """SELECT measurable, value FROM gpu_metrics
                   WHERE entity=? AND measurable IN (?,?,?)
                     AND ts=(SELECT MAX(ts) FROM gpu_metrics
                             WHERE entity=? AND measurable=gpu_metrics.measurable)""",
                (entity, *want, entity),
            ).fetchall()

        stats = {m: v for m, v in rows}
        if "gpu_utilization:average" in stats:
            util_pcts.append(stats["gpu_utilization:average"])
        if "gpu_mem_utilization:average" in stats:
            mem_pcts.append(stats["gpu_mem_utilization:average"])
        if "gpu_power_usage:total" in stats:
            power_total += stats["gpu_power_usage:total"]

    return {
        "total_gpus":        total_gpus,
        "gpus_up":           gpus_up,
        "total_util_pct":    round(sum(util_pcts) / len(util_pcts), 1) if util_pcts else None,
        "total_mem_util_pct": round(sum(mem_pcts) / len(mem_pcts), 1) if mem_pcts else None,
        "total_power_w":     round(power_total, 1) if power_total else None,
    }


def query_node_latest(nodes: List[str]) -> List[Dict]:
    results = []
    want = ("gpu_utilization:average", "gpu_mem_utilization:average",
            "gpu_temperature:average", "gpu_power_usage:total")
    for entity in nodes:
        with sqlite3.connect(DB_PATH) as conn:
            rows = conn.execute("""
                SELECT measurable, value
                FROM gpu_metrics
                WHERE entity = ?
                  AND measurable IN (?,?,?,?)
                  AND ts = (
                      SELECT MAX(ts) FROM gpu_metrics
                      WHERE entity = ? AND measurable = gpu_metrics.measurable
                  )
            """, (entity, *want, entity)).fetchall()
        stats = {m: v for m, v in rows}
        results.append({
            "entity":      entity,
            "gpu_util":    stats.get("gpu_utilization:average"),
            "mem_util":    stats.get("gpu_mem_utilization:average"),
            "temperature": stats.get("gpu_temperature:average"),
            "power_w":     stats.get("gpu_power_usage:total"),
        })
    return results


async def collector_loop():
    init_db()
    while True:
        try:
            await collect_once()
        except Exception as e:
            print(f"[gpu-collector] {e}")
        await asyncio.sleep(60)
