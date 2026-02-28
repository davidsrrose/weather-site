"""Shared Open-Meteo geocoding HTTP client helpers."""

from typing import Any

import httpx

OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"


class OpenMeteoGeocodeClientError(Exception):
    """Raised when Open-Meteo geocode requests fail."""


async def fetch_us_geocode_results(
    query: str,
    *,
    count: int,
    request_timeout_seconds: float,
) -> list[dict[str, Any]]:
    """Fetch raw USA geocoding results from Open-Meteo.

    Args:
        query: User search text (ZIP or city string).
        count: Max number of results to request.
        request_timeout_seconds: Request timeout in seconds.

    Returns:
        A list of raw geocoding result objects from Open-Meteo.

    Raises:
        OpenMeteoGeocodeClientError: If the upstream request fails or returns
            an invalid JSON payload.
    """
    normalized_query = query.strip()
    normalized_count = max(1, min(count, 100))
    params = {
        "name": normalized_query,
        "count": normalized_count,
        "language": "en",
        "format": "json",
        "countryCode": "US",
    }

    try:
        async with httpx.AsyncClient(timeout=request_timeout_seconds) as client:
            response = await client.get(OPEN_METEO_GEOCODING_URL, params=params)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise OpenMeteoGeocodeClientError("Open-Meteo geocode request failed.") from exc

    try:
        payload: Any = response.json()
    except ValueError as exc:
        raise OpenMeteoGeocodeClientError(
            "Open-Meteo geocode returned invalid JSON."
        ) from exc

    if not isinstance(payload, dict):
        raise OpenMeteoGeocodeClientError(
            "Open-Meteo geocode returned an invalid payload."
        )

    raw_results = payload.get("results")
    if not isinstance(raw_results, list):
        return []

    return [result for result in raw_results if isinstance(result, dict)]
