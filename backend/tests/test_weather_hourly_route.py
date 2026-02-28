"""Tests for weather hourly API route behavior."""

from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from fastapi_app.pipelines.weather_hourly import WeatherHourlyPipelineError
from fastapi_app.main import app


class WeatherHourlyRouteTests(unittest.TestCase):
    """Unit tests for GET /api/weather/hourly."""

    def test_weather_hourly_success_payload(self) -> None:
        """Endpoint returns stable payload shape for valid coordinates."""
        fake_payload = {
            "generated_at": "2026-02-27T16:00:00+00:00",
            "location": {"lat": 39.7555, "lon": -105.2211},
            "periods": [
                {
                    "startTime": "2026-02-27T16:00:00-07:00",
                    "temperature": 32,
                    "temperatureUnit": "F",
                    "isDaytime": True,
                    "shortForecast": "Snow Showers Likely",
                    "windSpeedMph": 5,
                    "windDirection": "NW",
                    "probabilityOfPrecipitation": 70,
                    "skyCover": 80,
                    "relativeHumidity": 63,
                    "icon": "https://api.weather.gov/icons/land/day/snow,70?size=medium",
                }
            ],
        }

        with patch(
            "fastapi_app.api.weather.get_hourly_weather_payload",
            return_value=fake_payload,
        ):
            with TestClient(app) as client:
                response = client.get(
                    "/api/weather/hourly", params={"lat": 39.7555, "lon": -105.2211}
                )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload, fake_payload)

    def test_weather_hourly_invalid_latitude_returns_422(self) -> None:
        """Endpoint returns 422 for invalid latitude input."""
        with TestClient(app) as client:
            response = client.get(
                "/api/weather/hourly", params={"lat": 95, "lon": -105.2211}
            )

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["detail"]["error"], "invalid_latitude")

    def test_weather_hourly_invalid_longitude_returns_422(self) -> None:
        """Endpoint returns 422 for invalid longitude input."""
        with TestClient(app) as client:
            response = client.get(
                "/api/weather/hourly", params={"lat": 39.7555, "lon": -185}
            )

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["detail"]["error"], "invalid_longitude")

    def test_weather_hourly_upstream_failure_maps_to_502(self) -> None:
        """Endpoint maps upstream pipeline errors to stable 502 payload."""
        with patch(
            "fastapi_app.api.weather.get_hourly_weather_payload",
            side_effect=WeatherHourlyPipelineError(
                "upstream request failed", upstream_status=503
            ),
        ):
            with TestClient(app) as client:
                response = client.get(
                    "/api/weather/hourly", params={"lat": 39.7555, "lon": -105.2211}
                )

        self.assertEqual(response.status_code, 502)
        payload = response.json()
        self.assertEqual(
            payload["detail"],
            {
                "error": "upstream_error",
                "message": "Unable to load hourly forecast right now.",
                "upstream_status": 503,
            },
        )

    def test_weather_hourly_two_quick_calls_use_cache(self) -> None:
        """Two quick endpoint calls should fetch upstream periods once."""
        fetch_call_count = 0

        def _fetch_periods(
            _: float,
            __: float,
            ___: float,
        ) -> list[dict[str, object]]:
            nonlocal fetch_call_count
            fetch_call_count += 1
            return [
                {"startTime": "2026-02-27T16:00:00-07:00", "call": fetch_call_count}
            ]

        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = str(Path(temp_dir) / "weather.duckdb")
            mock_config = type(
                "MockConfig",
                (),
                {
                    "duckdb_path": db_path,
                    "weather_hourly_http_timeout_seconds": 15.0,
                    "forecast_cache_ttl_minutes": 10,
                },
            )()

            with patch("fastapi_app.api.weather.config", new=mock_config):
                with patch(
                    "fastapi_app.api.weather.fetch_hourly_periods_for_location",
                    side_effect=_fetch_periods,
                ):
                    with TestClient(app) as client:
                        first_response = client.get(
                            "/api/weather/hourly",
                            params={"lat": 39.7555, "lon": -105.2211},
                        )
                        second_response = client.get(
                            "/api/weather/hourly",
                            params={"lat": 39.7555, "lon": -105.2211},
                        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(fetch_call_count, 1)
        self.assertEqual(first_response.json()["periods"][0]["call"], 1)
        self.assertEqual(second_response.json()["periods"][0]["call"], 1)


if __name__ == "__main__":
    unittest.main()
