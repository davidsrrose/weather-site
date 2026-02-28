"""City geocode suggestion API routes."""

from fastapi import APIRouter, HTTPException, Query

from config import config
from fastapi_app.routes.error_responses import upstream_error_detail
from fastapi_app.services.city_geocode_service import (
    CityGeocodeUpstreamError,
    search_us_city_suggestions,
)

router = APIRouter(prefix="/geocode", tags=["city-geocode"])


@router.get("/city")
async def get_city_suggestions(
    query: str = Query(..., min_length=2, description="City search text"),
    limit: int = Query(8, ge=1, le=20, description="Max suggestions"),
) -> dict[str, object]:
    """Return USA city/state suggestions with coordinates.

    Args:
        query: City text entered by user.
        limit: Max number of suggestions to return.

    Returns:
        Query echo and normalized city suggestion list.
    """
    try:
        suggestions = await search_us_city_suggestions(
            query=query,
            limit=limit,
            request_timeout_seconds=config.open_meteo_geocode_http_timeout_seconds,
        )
    except CityGeocodeUpstreamError as exc:
        raise HTTPException(
            status_code=502,
            detail=upstream_error_detail("Unable to search cities right now."),
        ) from exc

    return {
        "query": query.strip(),
        "suggestions": [suggestion.to_dict() for suggestion in suggestions],
    }
