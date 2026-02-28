"""US city suggestion service for location search."""


from dataclasses import asdict, dataclass
from typing import Any

from fastapi_app.services.open_meteo_geocode_client import (
    OpenMeteoGeocodeClientError,
    fetch_us_geocode_results,
)

DEFAULT_CITY_SUGGESTION_LIMIT = 8
DEFAULT_CITY_SUGGESTION_TIMEOUT_SECONDS = 8.0


class CityGeocodeUpstreamError(Exception):
    """Raised when upstream city geocoding cannot return usable data."""


@dataclass(frozen=True)
class CitySuggestion:
    """City suggestion payload returned to frontend clients."""

    label: str
    city: str
    state: str
    lat: float
    lon: float

    def to_dict(self) -> dict[str, Any]:
        """Return city suggestion as a serializable dictionary."""
        return asdict(self)


def _normalize_suggestion(item: dict[str, Any]) -> CitySuggestion | None:
    """Normalize one open-meteo result item into a CitySuggestion.

    Args:
        item: Open-meteo geocoding result object.

    Returns:
        Normalized city suggestion when valid; otherwise None.
    """
    city = item.get("name")
    state = item.get("admin1")
    latitude = item.get("latitude")
    longitude = item.get("longitude")
    country_code = item.get("country_code")

    if (
        not isinstance(city, str)
        or not isinstance(state, str)
        or not isinstance(country_code, str)
        or country_code.upper() != "US"
        or not isinstance(latitude, (int, float))
        or not isinstance(longitude, (int, float))
    ):
        return None

    return CitySuggestion(
        label=f"{city}, {state}",
        city=city,
        state=state,
        lat=float(latitude),
        lon=float(longitude),
    )


async def search_us_city_suggestions(
    query: str,
    *,
    limit: int = DEFAULT_CITY_SUGGESTION_LIMIT,
    request_timeout_seconds: float = DEFAULT_CITY_SUGGESTION_TIMEOUT_SECONDS,
) -> list[CitySuggestion]:
    """Search city suggestions for USA locations using open-meteo geocoding.

    Args:
        query: City search text from user input.
        limit: Max number of suggestions to return.
        request_timeout_seconds: Timeout for upstream request.

    Returns:
        List of normalized, de-duplicated city suggestions.

    Raises:
        CityGeocodeUpstreamError: If upstream request fails.
    """
    normalized_query = query.strip()
    if len(normalized_query) < 2:
        return []

    normalized_limit = max(1, min(limit, 20))
    try:
        raw_results = await fetch_us_geocode_results(
            query=normalized_query,
            count=normalized_limit * 3,
            request_timeout_seconds=request_timeout_seconds,
        )
    except OpenMeteoGeocodeClientError as exc:
        raise CityGeocodeUpstreamError(
            "Upstream city search request failed."
        ) from exc

    dedupe_keys: set[tuple[str, str]] = set()
    suggestions: list[CitySuggestion] = []
    for item in raw_results:
        if not isinstance(item, dict):
            continue
        suggestion = _normalize_suggestion(item)
        if suggestion is None:
            continue
        dedupe_key = (suggestion.city.lower(), suggestion.state.lower())
        if dedupe_key in dedupe_keys:
            continue
        dedupe_keys.add(dedupe_key)
        suggestions.append(suggestion)
        if len(suggestions) >= normalized_limit:
            break

    return suggestions
