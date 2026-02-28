# Backend

## Setup
From repo root:
1. Install dependencies:
   - `uv sync`
2. Non-secret defaults live in `config.py`:
   - `duckdb_path`
   - `forecast_cache_ttl_minutes`
   - `weather_hourly_http_timeout_seconds`
   - `zip_geocode_cache_ttl_days`
   - `open_meteo_geocode_http_timeout_seconds`

## Run
From `backend/`:
1. Start the API server:
   - `uv run uvicorn fastapi_app.main:app --reload --port 8000`

## Verify
From a second terminal:
1. Health check:
   - `curl -i http://127.0.0.1:8000/api/health`
2. Geocode valid ZIP:
   - `curl -i http://127.0.0.1:8000/api/geocode/zip/10001`
3. Geocode invalid ZIP:
   - `curl -i http://127.0.0.1:8000/api/geocode/zip/1234`
4. Search city suggestions (USA):
   - `curl -i "http://127.0.0.1:8000/api/geocode/city?query=golden&limit=5"`
5. Hourly weather for valid coords:
   - `curl -i "http://127.0.0.1:8000/api/weather/hourly?lat=39.7555&lon=-105.2211"`
6. Hourly weather for invalid coords:
   - `curl -i "http://127.0.0.1:8000/api/weather/hourly?lat=95&lon=-105.2211"`

Expected behavior:
- Health returns `200` and `{"status":"ok"}`.
- Valid ZIP returns `lat`, `lon`, `city`, `state`, and `source`.
- Invalid ZIP returns `422` with an `invalid_zip` payload.
- Repeated ZIP requests can return `source: "cache"` (see backend logs for cache hit/miss).
- Valid weather coordinates return `generated_at`, `location`, and hourly `periods`.
- Invalid weather coordinates return `422`.
- Repeated weather requests for same coords within 10 minutes return cached snapshots.
- Weather cache logs include `cache_hit`, `cache_miss`, and `cache_stale_refresh`.

## Pipeline Tests
From `backend/`:
1. Run weather hourly pipeline unit tests:
   - `PYTHONPATH=src uv run python -m unittest discover -s tests -p 'test_*.py' -v`

## Notes
- API runs on port `8000`.
- DuckDB parent directory is created automatically if missing.
- Non-secret defaults live in `backend/config.py`.
