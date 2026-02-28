"""dlt source/resource for weather.gov hourly forecast ingestion."""


from collections.abc import Iterable
import re
from typing import Any

import dlt
import httpx

WIND_SPEED_PATTERN = re.compile(r"\d+")
ICON_CODE_PATTERN = re.compile(r"/(?:day|night)/([^?]+)")
WEATHER_GOV_BASE_URL = "https://api.weather.gov"
DEFAULT_HTTP_TIMEOUT_SECONDS = 15.0


class WeatherHourlyPipelineError(RuntimeError):
    """Raised when upstream weather.gov payloads are invalid for the pipeline."""

    def __init__(self, message: str, upstream_status: int | None = None) -> None:
        """Initialize a weather hourly pipeline error.

        Args:
            message: Human-readable error message.
            upstream_status: Optional HTTP status code from upstream service.
        """
        super().__init__(message)
        self.upstream_status = upstream_status


def parse_wind_speed_mph(wind_speed: str | None) -> int | None:
    """Parse a weather.gov wind speed string into integer mph.

    Args:
        wind_speed: Wind speed string like "5 mph" or "5 to 10 mph".

    Returns:
        Integer mph when parsable, otherwise None.
    """
    if not wind_speed:
        return None

    speed_parts: list[int] = [int(match) for match in WIND_SPEED_PATTERN.findall(wind_speed)]
    if not speed_parts:
        return None

    if len(speed_parts) == 1:
        return speed_parts[0]

    return round((speed_parts[0] + speed_parts[1]) / 2)


def _extract_measurement_value(measurement: Any) -> float | int | None:
    """Extract value from weather.gov measurement payload.

    Args:
        measurement: Payload section that can include a numeric `value`.

    Returns:
        Numeric value when present, otherwise None.
    """
    if not isinstance(measurement, dict):
        return None

    value: Any = measurement.get("value")
    if isinstance(value, (int, float)):
        return value

    return None


def _estimate_sky_cover_from_icon(icon_url: str | None) -> int | None:
    """Estimate sky cover percentage from weather.gov icon code."""
    if not icon_url:
        return None

    match = ICON_CODE_PATTERN.search(icon_url)
    if not match:
        return None

    icon_code = match.group(1).split(",")[0].lower()
    if icon_code in {"skc", "clr"}:
        return 0
    if icon_code == "few":
        return 20
    if icon_code == "sct":
        return 45
    if icon_code == "bkn":
        return 75
    if icon_code == "ovc":
        return 100
    return None


def _estimate_sky_cover_from_short_forecast(short_forecast: str | None) -> int | None:
    """Estimate sky cover percentage from short forecast text."""
    if not short_forecast:
        return None

    text = short_forecast.lower()
    if "overcast" in text or "cloudy" in text and "mostly" not in text and "partly" not in text:
        return 100
    if "mostly cloudy" in text:
        return 75
    if "partly cloudy" in text or "partly sunny" in text:
        return 45
    if "mostly clear" in text or "mostly sunny" in text:
        return 20
    if "clear" in text or "sunny" in text:
        return 0
    return None


def normalize_hourly_period(period: dict[str, Any]) -> dict[str, Any]:
    """Normalize one hourly period from weather.gov into pipeline schema.

    Args:
        period: Raw period payload from `properties.periods`.

    Returns:
        Normalized period dictionary with stable keys.
    """
    sky_cover = _extract_measurement_value(period.get("skyCover"))
    if not isinstance(sky_cover, (int, float)):
        sky_cover = _estimate_sky_cover_from_icon(period.get("icon"))
    if not isinstance(sky_cover, (int, float)):
        sky_cover = _estimate_sky_cover_from_short_forecast(period.get("shortForecast"))
    is_daytime: Any = period.get("isDaytime")

    return {
        "startTime": period.get("startTime"),
        "temperature": period.get("temperature"),
        "temperatureUnit": period.get("temperatureUnit"),
        "isDaytime": is_daytime if isinstance(is_daytime, bool) else None,
        "shortForecast": period.get("shortForecast"),
        "windSpeedMph": parse_wind_speed_mph(period.get("windSpeed")),
        "windDirection": period.get("windDirection"),
        "probabilityOfPrecipitation": _extract_measurement_value(
            period.get("probabilityOfPrecipitation")
        ),
        "skyCover": sky_cover,
        "relativeHumidity": _extract_measurement_value(period.get("relativeHumidity")),
        "icon": period.get("icon"),
    }


def _build_points_url(lat: float, lon: float) -> str:
    """Build the weather.gov points URL for a coordinate pair.

    Args:
        lat: Latitude.
        lon: Longitude.

    Returns:
        Full points endpoint URL.
    """
    return f"{WEATHER_GOV_BASE_URL}/points/{lat},{lon}"


def _get_json(client: httpx.Client, url: str) -> dict[str, Any]:
    """Fetch JSON payload from a URL.

    Args:
        client: HTTP client to use.
        url: URL to fetch.

    Returns:
        Parsed JSON object.

    Raises:
        WeatherHourlyPipelineError: If the request fails or payload is invalid.
    """
    try:
        response = client.get(url)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        status_code: int | None = exc.response.status_code if exc.response else None
        raise WeatherHourlyPipelineError(
            f"Upstream request failed for URL: {url}",
            upstream_status=status_code,
        ) from exc
    except httpx.HTTPError as exc:
        raise WeatherHourlyPipelineError(f"Request failed for URL: {url}") from exc

    try:
        payload: Any = response.json()
    except ValueError as exc:
        raise WeatherHourlyPipelineError(f"Invalid JSON payload from URL: {url}") from exc

    if not isinstance(payload, dict):
        raise WeatherHourlyPipelineError(f"Expected JSON object payload from URL: {url}")

    return payload


def fetch_hourly_periods(
    *, lat: float, lon: float, client: httpx.Client
) -> list[dict[str, Any]]:
    """Fetch and normalize hourly periods for a lat/lon pair.

    Args:
        lat: Latitude.
        lon: Longitude.
        client: HTTP client for upstream requests.

    Returns:
        List of normalized hourly period records.

    Raises:
        WeatherHourlyPipelineError: If required upstream fields are missing.
    """
    points_url: str = _build_points_url(lat=lat, lon=lon)
    points_payload: dict[str, Any] = _get_json(client=client, url=points_url)

    properties: Any = points_payload.get("properties")
    if not isinstance(properties, dict):
        raise WeatherHourlyPipelineError("weather.gov points payload missing properties")

    forecast_hourly_url: Any = properties.get("forecastHourly")
    if not isinstance(forecast_hourly_url, str) or not forecast_hourly_url:
        raise WeatherHourlyPipelineError(
            "weather.gov points payload missing properties.forecastHourly"
        )

    hourly_payload: dict[str, Any] = _get_json(client=client, url=forecast_hourly_url)
    hourly_properties: Any = hourly_payload.get("properties")
    if not isinstance(hourly_properties, dict):
        return []

    periods: Any = hourly_properties.get("periods")
    if not isinstance(periods, list):
        return []

    normalized_rows: list[dict[str, Any]] = []
    for period in periods:
        if not isinstance(period, dict):
            continue
        normalized_rows.append(normalize_hourly_period(period))

    return normalized_rows


@dlt.resource(name="weather_hourly_periods")
def weather_hourly_resource(
    lat: float,
    lon: float,
    http_timeout_seconds: float = DEFAULT_HTTP_TIMEOUT_SECONDS,
) -> Iterable[dict[str, Any]]:
    """Yield normalized weather.gov hourly period records for one coordinate pair.

    Args:
        lat: Latitude.
        lon: Longitude.
        http_timeout_seconds: HTTP timeout for weather.gov requests.

    Yields:
        Normalized hourly period dictionaries.
    """
    with httpx.Client(timeout=http_timeout_seconds) as client:
        rows: list[dict[str, Any]] = fetch_hourly_periods(lat=lat, lon=lon, client=client)

    for row in rows:
        yield row


@dlt.source(name="weather_hourly")
def weather_hourly_source(
    lat: float,
    lon: float,
    http_timeout_seconds: float = DEFAULT_HTTP_TIMEOUT_SECONDS,
) -> Iterable[dict[str, Any]]:
    """Create the weather hourly dlt source.

    Args:
        lat: Latitude.
        lon: Longitude.
        http_timeout_seconds: HTTP timeout for weather.gov requests.

    Returns:
        dlt resource configured for the provided coordinates.
    """
    return weather_hourly_resource(
        lat=lat,
        lon=lon,
        http_timeout_seconds=http_timeout_seconds,
    )
