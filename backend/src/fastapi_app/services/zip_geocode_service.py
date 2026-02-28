"""ZIP geocode service with DuckDB-backed ZIP cache."""


from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
import logging
from typing import Any

import duckdb

from fastapi_app.services.duckdb import ensure_duckdb_parent_dir
from fastapi_app.services.open_meteo_geocode_client import (
    OpenMeteoGeocodeClientError,
    fetch_us_geocode_results,
)

logger = logging.getLogger("uvicorn.error")

DEFAULT_ZIP_CACHE_TTL_DAYS = 30
DEFAULT_OPEN_METEO_HTTP_TIMEOUT_SECONDS = 10.0


class ZipGeocodeUpstreamError(Exception):
    """Raised when upstream geocoding cannot return usable data."""


@dataclass(frozen=True)
class ZipGeocodeResult:
    """Normalized geocode payload returned by the API."""

    zip: str
    lat: float
    lon: float
    city: str
    state: str
    source: str

    def to_dict(self) -> dict[str, Any]:
        """Return the dataclass as a serializable dictionary."""
        return asdict(self)


def _utc_now_naive() -> datetime:
    """Return current UTC timestamp as naive datetime for DuckDB TIMESTAMP."""
    return datetime.now(UTC).replace(tzinfo=None)


def _ensure_zip_cache_table(connection: duckdb.DuckDBPyConnection) -> None:
    """Create the ZIP cache table if it does not exist."""
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS zip_cache (
            zip TEXT PRIMARY KEY,
            lat DOUBLE,
            lon DOUBLE,
            city TEXT,
            state TEXT,
            fetched_at TIMESTAMP
        )
        """
    )


def _is_fresh(fetched_at: datetime, zip_cache_max_age: timedelta) -> bool:
    """Return whether a cached row is still within max cache age."""
    return _utc_now_naive() - fetched_at < zip_cache_max_age


def _read_cached_zip(
    connection: duckdb.DuckDBPyConnection, zip_code: str, zip_cache_max_age: timedelta
) -> ZipGeocodeResult | None:
    """Read cached geocode data for a ZIP, if present and fresh."""
    row = connection.execute(
        """
        SELECT zip, lat, lon, city, state, fetched_at
        FROM zip_cache
        WHERE zip = ?
        """,
        [zip_code],
    ).fetchone()

    if row is None:
        return None

    fetched_at: datetime = row[5]
    if not _is_fresh(fetched_at, zip_cache_max_age=zip_cache_max_age):
        return None

    logger.info("zip cache hit zip=%s fetched_at=%s", zip_code, fetched_at.isoformat())
    return ZipGeocodeResult(
        zip=row[0],
        lat=float(row[1]),
        lon=float(row[2]),
        city=str(row[3]),
        state=str(row[4]),
        source="cache",
    )


def _upsert_cached_zip(
    connection: duckdb.DuckDBPyConnection, result: ZipGeocodeResult
) -> None:
    """Insert or update a ZIP cache row with fresh geocode data."""
    fetched_at = _utc_now_naive()
    connection.execute(
        """
        INSERT INTO zip_cache (zip, lat, lon, city, state, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (zip) DO UPDATE SET
            lat = EXCLUDED.lat,
            lon = EXCLUDED.lon,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            fetched_at = EXCLUDED.fetched_at
        """,
        [
            result.zip,
            result.lat,
            result.lon,
            result.city,
            result.state,
            fetched_at,
        ],
    )


def _parse_open_meteo_result(zip_code: str, first_match: dict[str, Any]) -> ZipGeocodeResult:
    """Normalize one Open-Meteo result object into ZIP response model."""
    latitude = first_match.get("latitude")
    longitude = first_match.get("longitude")
    city = first_match.get("name")
    state = first_match.get("admin1")
    country_code = first_match.get("country_code")

    if (
        not isinstance(latitude, (int, float))
        or not isinstance(longitude, (int, float))
        or not isinstance(city, str)
        or not isinstance(state, str)
        or not isinstance(country_code, str)
        or country_code.upper() != "US"
    ):
        raise ZipGeocodeUpstreamError("Incomplete upstream geocode payload.")

    return ZipGeocodeResult(
        zip=zip_code,
        lat=float(latitude),
        lon=float(longitude),
        city=city,
        state=state,
        source="upstream",
    )


async def _fetch_upstream_zip_geocode(
    zip_code: str, request_timeout_seconds: float
) -> ZipGeocodeResult:
    """Fetch geocode data from open-meteo geocoding API."""
    try:
        raw_results = await fetch_us_geocode_results(
            query=zip_code,
            count=1,
            request_timeout_seconds=request_timeout_seconds,
        )
    except OpenMeteoGeocodeClientError as exc:
        raise ZipGeocodeUpstreamError("Upstream geocode request failed.") from exc

    if not raw_results:
        raise ZipGeocodeUpstreamError("No upstream geocode results for ZIP.")

    return _parse_open_meteo_result(zip_code=zip_code, first_match=raw_results[0])


async def get_zip_geocode(
    zip_code: str,
    duckdb_path: str,
    zip_cache_ttl_days: int = DEFAULT_ZIP_CACHE_TTL_DAYS,
    request_timeout_seconds: float = DEFAULT_OPEN_METEO_HTTP_TIMEOUT_SECONDS,
) -> ZipGeocodeResult:
    """Resolve ZIP geocode using cache-first strategy with upstream fallback.

    Args:
        zip_code: ZIP code to geocode.
        duckdb_path: Path to DuckDB file.
        zip_cache_ttl_days: ZIP cache freshness in days.
        request_timeout_seconds: Timeout for upstream geocode requests.

    Returns:
        Geocoded ZIP payload from cache or upstream.
    """
    zip_cache_max_age = timedelta(days=zip_cache_ttl_days)
    resolved_db_path = ensure_duckdb_parent_dir(duckdb_path)
    connection = duckdb.connect(str(resolved_db_path))

    try:
        _ensure_zip_cache_table(connection)
        cached = _read_cached_zip(
            connection,
            zip_code,
            zip_cache_max_age=zip_cache_max_age,
        )
        if cached is not None:
            return cached

        logger.info("zip cache miss zip=%s fetching upstream", zip_code)
        upstream = await _fetch_upstream_zip_geocode(
            zip_code=zip_code,
            request_timeout_seconds=request_timeout_seconds,
        )
        _upsert_cached_zip(connection, upstream)
        return upstream
    finally:
        connection.close()
