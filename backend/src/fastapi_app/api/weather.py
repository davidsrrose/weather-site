"""Weather API routes."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from fastapi_app.api.request_validation import validate_latitude, validate_longitude
from fastapi_app.pipelines.weather_hourly import (
    WeatherHourlyPipelineError,
    weather_hourly_source,
)
from fastapi_app.routes.error_responses import upstream_error_detail
from fastapi_app.services.forecast_snapshot_cache import get_or_refresh_hourly_forecast
from config import config

router = APIRouter(prefix="/weather", tags=["weather"])


def fetch_hourly_periods_for_location(
    lat: float,
    lon: float,
    http_timeout_seconds: float,
) -> list[dict[str, Any]]:
    """Fetch normalized hourly periods through dlt source.

    Args:
        lat: Latitude.
        lon: Longitude.
        http_timeout_seconds: HTTP timeout for weather.gov requests.

    Returns:
        Normalized hourly weather periods.
    """
    source = weather_hourly_source(
        lat=lat,
        lon=lon,
        http_timeout_seconds=http_timeout_seconds,
    )
    resource = source.resources["weather_hourly_periods"]
    return list(resource)


def get_hourly_weather_payload(lat: float, lon: float) -> dict[str, Any]:
    """Get hourly weather payload with DuckDB snapshot caching.

    Args:
        lat: Latitude.
        lon: Longitude.

    Returns:
        Stable payload with generated_at, location, and periods.
    """
    return get_or_refresh_hourly_forecast(
        lat=lat,
        lon=lon,
        duckdb_path=config.duckdb_path,
        fetch_periods=lambda resolved_lat, resolved_lon: (
            fetch_hourly_periods_for_location(
                resolved_lat,
                resolved_lon,
                config.weather_hourly_http_timeout_seconds,
            )
        ),
        cache_ttl_minutes=config.forecast_cache_ttl_minutes,
    )


@router.get("/hourly")
def get_hourly_weather(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
) -> dict[str, Any]:
    """Return normalized hourly weather periods for coordinates.

    Args:
        lat: Latitude query parameter.
        lon: Longitude query parameter.

    Returns:
        Weather payload containing location, generated timestamp, and periods.
    """
    validate_latitude(lat)
    validate_longitude(lon)

    try:
        payload = get_hourly_weather_payload(lat=lat, lon=lon)
    except WeatherHourlyPipelineError as exc:
        raise HTTPException(
            status_code=502,
            detail=upstream_error_detail(
                "Unable to load hourly forecast right now.",
                upstream_status=exc.upstream_status,
            ),
        ) from exc

    return payload
