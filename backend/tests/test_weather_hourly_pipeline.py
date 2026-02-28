"""Tests for weather hourly dlt pipeline normalization."""


import json
from pathlib import Path
import sys
from typing import Any
import unittest
from unittest.mock import patch

import httpx

BACKEND_SRC_PATH = Path(__file__).resolve().parents[1] / "src"
if str(BACKEND_SRC_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC_PATH))

from fastapi_app.pipelines.weather_hourly import (
    fetch_hourly_periods,
    normalize_hourly_period,
    weather_hourly_resource,
)


def _load_fixture_json(name: str) -> dict[str, Any]:
    """Load a JSON fixture from backend/tests/fixtures.

    Args:
        name: Fixture file name.

    Returns:
        Parsed JSON object.
    """
    fixture_path = Path(__file__).resolve().parent / "fixtures" / name
    with fixture_path.open("r", encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


def _build_mock_weather_gov_client(
    *,
    lat: float,
    lon: float,
    points_payload: dict[str, Any],
    hourly_payload: dict[str, Any],
) -> httpx.Client:
    """Build an httpx client that serves fixture payloads for weather.gov endpoints.

    Args:
        lat: Latitude for points URL.
        lon: Longitude for points URL.
        points_payload: Payload returned from points endpoint.
        hourly_payload: Payload returned from forecast hourly endpoint.

    Returns:
        Mocked HTTP client.
    """
    points_url = f"https://api.weather.gov/points/{lat},{lon}"
    hourly_url = points_payload["properties"]["forecastHourly"]

    def _handler(request: httpx.Request) -> httpx.Response:
        request_url = str(request.url)
        if request_url == points_url:
            return httpx.Response(200, json=points_payload)
        if request_url == hourly_url:
            return httpx.Response(200, json=hourly_payload)
        return httpx.Response(404, json={"detail": "not found"})

    return httpx.Client(transport=httpx.MockTransport(_handler))


class WeatherHourlyPipelineTests(unittest.TestCase):
    """Unit tests for weather hourly pipeline behavior."""

    def test_fetch_hourly_periods_from_fixtures_normalizes_schema(self) -> None:
        """Pipeline returns normalized rows with a stable output schema."""
        lat = 39.7555
        lon = -105.2211
        points_payload = _load_fixture_json("points.json")
        hourly_payload = _load_fixture_json("hourly.json")

        client = _build_mock_weather_gov_client(
            lat=lat,
            lon=lon,
            points_payload=points_payload,
            hourly_payload=hourly_payload,
        )
        with client:
            rows = fetch_hourly_periods(lat=lat, lon=lon, client=client)

        self.assertEqual(len(rows), 2)

        expected_keys = {
            "startTime",
            "temperature",
            "temperatureUnit",
            "isDaytime",
            "shortForecast",
            "windSpeedMph",
            "windDirection",
            "probabilityOfPrecipitation",
            "skyCover",
            "relativeHumidity",
            "icon",
        }

        for row in rows:
            self.assertEqual(set(row.keys()), expected_keys)

        self.assertEqual(rows[0]["windSpeedMph"], 5)
        self.assertEqual(rows[1]["windSpeedMph"], 8)
        self.assertTrue(rows[0]["isDaytime"])
        self.assertFalse(rows[1]["isDaytime"])
        self.assertEqual(rows[0]["probabilityOfPrecipitation"], 70)
        self.assertEqual(rows[0]["skyCover"], 80)
        self.assertIsNone(rows[1]["probabilityOfPrecipitation"])
        self.assertEqual(rows[1]["skyCover"], 75)
        self.assertEqual(rows[0]["startTime"], "2026-02-27T16:00:00-07:00")

    def test_normalize_hourly_period_missing_fields_do_not_crash(self) -> None:
        """Missing optional upstream fields map to None and do not raise errors."""
        period = {
            "startTime": "2026-02-27T18:00:00-07:00",
            "temperature": 28,
            "temperatureUnit": "F",
            "shortForecast": "Mostly Cloudy",
        }

        normalized = normalize_hourly_period(period)

        self.assertEqual(normalized["startTime"], "2026-02-27T18:00:00-07:00")
        self.assertEqual(normalized["temperature"], 28)
        self.assertIsNone(normalized["isDaytime"])
        self.assertIsNone(normalized["windSpeedMph"])
        self.assertIsNone(normalized["probabilityOfPrecipitation"])
        self.assertEqual(normalized["skyCover"], 75)
        self.assertIsNone(normalized["relativeHumidity"])
        self.assertIsNone(normalized["icon"])

    def test_weather_hourly_resource_yields_normalized_rows(self) -> None:
        """dlt resource yields normalized records for known coordinates."""
        lat = 39.7555
        lon = -105.2211
        points_payload = _load_fixture_json("points.json")
        hourly_payload = _load_fixture_json("hourly.json")

        mock_client = _build_mock_weather_gov_client(
            lat=lat,
            lon=lon,
            points_payload=points_payload,
            hourly_payload=hourly_payload,
        )

        with patch(
            "fastapi_app.pipelines.weather_hourly.httpx.Client", return_value=mock_client
        ):
            rows = list(weather_hourly_resource(lat=lat, lon=lon))

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["startTime"], "2026-02-27T16:00:00-07:00")
        self.assertEqual(rows[0]["windSpeedMph"], 5)

    def test_normalize_hourly_period_estimates_sky_cover_when_missing(self) -> None:
        """Sky cover is estimated from icon when measurement is missing."""
        period = {
            "startTime": "2026-02-27T18:00:00-07:00",
            "temperature": 28,
            "temperatureUnit": "F",
            "shortForecast": "Mostly Cloudy",
            "icon": "https://api.weather.gov/icons/land/night/bkn?size=medium",
        }

        normalized = normalize_hourly_period(period)

        self.assertEqual(normalized["skyCover"], 75)


if __name__ == "__main__":
    unittest.main()
