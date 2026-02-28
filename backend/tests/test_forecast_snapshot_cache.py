"""Tests for DuckDB-backed forecast snapshot caching."""


from datetime import UTC, datetime, timedelta
import json
from pathlib import Path
import sys
import tempfile
import unittest

import duckdb

BACKEND_SRC_PATH = Path(__file__).resolve().parents[1] / "src"
if str(BACKEND_SRC_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC_PATH))

from fastapi_app.services.forecast_snapshot_cache import (
    build_location_key,
    get_or_refresh_hourly_forecast,
)


class ForecastSnapshotCacheTests(unittest.TestCase):
    """Unit tests for weather snapshot caching behavior."""

    def test_two_quick_calls_only_fetch_upstream_once(self) -> None:
        """Second call within TTL should return cached payload without refetch."""
        lat = 39.7555
        lon = -105.2211

        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = str(Path(temp_dir) / "weather.duckdb")
            fetch_call_count = 0

            def _fetch_periods(_: float, __: float) -> list[dict[str, object]]:
                nonlocal fetch_call_count
                fetch_call_count += 1
                return [{"startTime": "2026-02-27T16:00:00-07:00", "call": fetch_call_count}]

            first_payload = get_or_refresh_hourly_forecast(
                lat=lat,
                lon=lon,
                duckdb_path=db_path,
                fetch_periods=_fetch_periods,
            )
            second_payload = get_or_refresh_hourly_forecast(
                lat=lat,
                lon=lon,
                duckdb_path=db_path,
                fetch_periods=_fetch_periods,
            )

        self.assertEqual(fetch_call_count, 1)
        self.assertEqual(first_payload, second_payload)

    def test_stale_snapshot_triggers_refresh(self) -> None:
        """Snapshot older than TTL should refresh from upstream."""
        lat = 39.7555
        lon = -105.2211

        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = str(Path(temp_dir) / "weather.duckdb")
            fetch_call_count = 0

            def _fetch_periods(_: float, __: float) -> list[dict[str, object]]:
                nonlocal fetch_call_count
                fetch_call_count += 1
                return [{"startTime": "2026-02-27T16:00:00-07:00", "call": fetch_call_count}]

            first_payload = get_or_refresh_hourly_forecast(
                lat=lat,
                lon=lon,
                duckdb_path=db_path,
                fetch_periods=_fetch_periods,
            )

            location_key = build_location_key(lat=lat, lon=lon)
            stale_generated_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=11)
            connection = duckdb.connect(db_path)
            try:
                connection.execute(
                    """
                    UPDATE forecast_snapshots
                    SET generated_at = ?
                    WHERE location_key = ?
                    """,
                    [stale_generated_at, location_key],
                )
            finally:
                connection.close()

            second_payload = get_or_refresh_hourly_forecast(
                lat=lat,
                lon=lon,
                duckdb_path=db_path,
                fetch_periods=_fetch_periods,
            )

        self.assertEqual(fetch_call_count, 2)
        self.assertNotEqual(first_payload["generated_at"], second_payload["generated_at"])
        self.assertEqual(first_payload["periods"][0]["call"], 1)
        self.assertEqual(second_payload["periods"][0]["call"], 2)

    def test_snapshot_row_contains_latest_payload(self) -> None:
        """DuckDB snapshot table stores latest payload JSON for location key."""
        lat = 39.7555
        lon = -105.2211

        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = str(Path(temp_dir) / "weather.duckdb")

            payload = get_or_refresh_hourly_forecast(
                lat=lat,
                lon=lon,
                duckdb_path=db_path,
                fetch_periods=lambda _lat, _lon: [
                    {
                        "startTime": "2026-02-27T16:00:00-07:00",
                        "temperature": 32,
                    }
                ],
            )

            connection = duckdb.connect(db_path)
            try:
                location_key = build_location_key(lat=lat, lon=lon)
                row = connection.execute(
                    """
                    SELECT lat, lon, payload_json
                    FROM forecast_snapshots
                    WHERE location_key = ?
                    """,
                    [location_key],
                ).fetchone()
            finally:
                connection.close()

        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row[0], lat)
        self.assertEqual(row[1], lon)

        payload_from_db = json.loads(row[2])
        self.assertEqual(payload_from_db, payload)


if __name__ == "__main__":
    unittest.main()
