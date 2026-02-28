"""DuckDB-backed cache for hourly forecast snapshots."""


from collections.abc import Callable
from datetime import UTC, datetime, timedelta
import json
import logging
from typing import Any

import duckdb

from fastapi_app.services.duckdb import ensure_duckdb_parent_dir

logger = logging.getLogger("uvicorn.error")

DEFAULT_FORECAST_CACHE_TTL_MINUTES = 10


def build_location_key(lat: float, lon: float) -> str:
    """Build cache key from rounded coordinates.

    Args:
        lat: Latitude.
        lon: Longitude.

    Returns:
        Location key rounded to four decimals.
    """
    return f"{lat:.4f},{lon:.4f}"


def _utc_now_naive() -> datetime:
    """Return naive UTC timestamp for DuckDB TIMESTAMP columns."""
    return datetime.now(UTC).replace(tzinfo=None)


def _ensure_forecast_snapshot_table(connection: duckdb.DuckDBPyConnection) -> None:
    """Create forecast snapshot cache table if it does not exist."""
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS forecast_snapshots (
            location_key TEXT PRIMARY KEY,
            lat DOUBLE,
            lon DOUBLE,
            generated_at TIMESTAMP,
            payload_json TEXT
        )
        """
    )


def _is_fresh(generated_at: datetime, cache_ttl: timedelta) -> bool:
    """Return whether cached snapshot is still within TTL window."""
    return _utc_now_naive() - generated_at < cache_ttl


def _read_cached_payload(
    connection: duckdb.DuckDBPyConnection, location_key: str
) -> tuple[datetime, dict[str, Any]] | None:
    """Read and parse cached payload for a location key.

    Args:
        connection: Open DuckDB connection.
        location_key: Cache key.

    Returns:
        Tuple of generated timestamp and parsed payload when available.
    """
    row = connection.execute(
        """
        SELECT generated_at, payload_json
        FROM forecast_snapshots
        WHERE location_key = ?
        """,
        [location_key],
    ).fetchone()

    if row is None:
        return None

    generated_at: datetime = row[0]
    payload_json: str = row[1]
    try:
        payload = json.loads(payload_json)
    except (TypeError, ValueError):
        return None

    if not isinstance(payload, dict):
        return None

    return generated_at, payload


def _upsert_snapshot(
    connection: duckdb.DuckDBPyConnection,
    *,
    location_key: str,
    lat: float,
    lon: float,
    generated_at: datetime,
    payload: dict[str, Any],
) -> None:
    """Insert or update cached snapshot for coordinates."""
    payload_json = json.dumps(payload, separators=(",", ":"))
    connection.execute(
        """
        INSERT INTO forecast_snapshots (
            location_key,
            lat,
            lon,
            generated_at,
            payload_json
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (location_key) DO UPDATE SET
            lat = EXCLUDED.lat,
            lon = EXCLUDED.lon,
            generated_at = EXCLUDED.generated_at,
            payload_json = EXCLUDED.payload_json
        """,
        [location_key, lat, lon, generated_at, payload_json],
    )


def get_or_refresh_hourly_forecast(
    *,
    lat: float,
    lon: float,
    duckdb_path: str,
    fetch_periods: Callable[[float, float], list[dict[str, Any]]],
    cache_ttl_minutes: int = DEFAULT_FORECAST_CACHE_TTL_MINUTES,
) -> dict[str, Any]:
    """Get hourly forecast payload using cache-first strategy.

    Args:
        lat: Latitude.
        lon: Longitude.
        duckdb_path: Path to DuckDB file.
        fetch_periods: Function used to fetch fresh periods on cache miss/stale.
        cache_ttl_minutes: Freshness window for cached snapshots.

    Returns:
        Stable weather payload with generated_at, location, and periods.
    """
    cache_ttl = timedelta(minutes=cache_ttl_minutes)
    location_key = build_location_key(lat=lat, lon=lon)
    resolved_db_path = ensure_duckdb_parent_dir(duckdb_path)
    connection = duckdb.connect(str(resolved_db_path))

    try:
        _ensure_forecast_snapshot_table(connection)
        cached = _read_cached_payload(connection, location_key)
        if cached is not None:
            cached_generated_at, cached_payload = cached
            if _is_fresh(cached_generated_at, cache_ttl=cache_ttl):
                logger.info("cache_hit location_key=%s", location_key)
                return cached_payload
            logger.info(
                "cache_stale_refresh location_key=%s cached_generated_at=%s",
                location_key,
                cached_generated_at.isoformat(),
            )
        else:
            logger.info("cache_miss location_key=%s", location_key)

        periods = fetch_periods(lat, lon)
        generated_at_utc = datetime.now(UTC)
        payload = {
            "generated_at": generated_at_utc.isoformat(),
            "location": {"lat": lat, "lon": lon},
            "periods": periods,
        }
        _upsert_snapshot(
            connection,
            location_key=location_key,
            lat=lat,
            lon=lon,
            generated_at=generated_at_utc.replace(tzinfo=None),
            payload=payload,
        )
        return payload
    finally:
        connection.close()
