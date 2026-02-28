"""Shared request validation helpers for API endpoints."""

from fastapi import HTTPException


def validate_latitude(latitude: float) -> None:
    """Validate latitude range.

    Args:
        latitude: Latitude query parameter.

    Raises:
        HTTPException: If latitude is outside valid range.
    """
    if -90 <= latitude <= 90:
        return

    raise HTTPException(
        status_code=422,
        detail={
            "error": "invalid_latitude",
            "message": "Latitude must be between -90 and 90.",
            "lat": latitude,
        },
    )


def validate_longitude(longitude: float) -> None:
    """Validate longitude range.

    Args:
        longitude: Longitude query parameter.

    Raises:
        HTTPException: If longitude is outside valid range.
    """
    if -180 <= longitude <= 180:
        return

    raise HTTPException(
        status_code=422,
        detail={
            "error": "invalid_longitude",
            "message": "Longitude must be between -180 and 180.",
            "lon": longitude,
        },
    )
