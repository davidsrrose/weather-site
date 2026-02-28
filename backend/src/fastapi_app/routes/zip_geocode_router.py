"""ZIP geocode API routes."""

import re

from fastapi import APIRouter, HTTPException

from config import config
from fastapi_app.routes.error_responses import upstream_error_detail
from fastapi_app.services.zip_geocode_service import (
    ZipGeocodeNotFoundError,
    ZipGeocodeUpstreamError,
    get_zip_geocode,
)

ZIP_REGEX = re.compile(r"^\d{5}$")

router = APIRouter(prefix="/geocode", tags=["zip-geocode"])


def _validate_zip_code(zip_code: str) -> None:
    """Validate ZIP code format for geocoding endpoint."""
    if ZIP_REGEX.fullmatch(zip_code):
        return
    raise HTTPException(
        status_code=422,
        detail={
            "error": "invalid_zip",
            "message": "ZIP must be exactly 5 digits.",
            "zip": zip_code,
        },
    )


@router.get("/zip/{zip_code}")
async def get_zip_geocode_endpoint(zip_code: str) -> dict[str, object]:
    """Return geocode information for a ZIP code."""
    _validate_zip_code(zip_code)

    try:
        result = await get_zip_geocode(
            zip_code=zip_code,
            duckdb_path=config.duckdb_path,
            zip_cache_ttl_days=config.zip_geocode_cache_ttl_days,
            request_timeout_seconds=config.open_meteo_geocode_http_timeout_seconds,
        )
    except ZipGeocodeNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "zip_not_found",
                "message": f"No city found for ZIP {zip_code}.",
                "zip": zip_code,
            },
        ) from exc
    except ZipGeocodeUpstreamError as exc:
        raise HTTPException(
            status_code=502,
            detail=upstream_error_detail("Unable to resolve ZIP right now."),
        ) from exc

    return result.to_dict()
