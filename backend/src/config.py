from pydantic import BaseModel


class Config(BaseModel):
    duckdb_path: str = ".data/weather.duckdb"
    forecast_cache_ttl_minutes: int = 10
    zip_geocode_cache_ttl_days: int = 30
    weather_hourly_http_timeout_seconds: float = 15.0
    open_meteo_geocode_http_timeout_seconds: float = 10.0


config = Config()
