"""Shared API error payload helpers."""



def upstream_error_detail(
    message: str, upstream_status: int | None = None
) -> dict[str, object]:
    """Build a stable upstream error payload.

    Args:
        message: Human-readable error description for API clients.
        upstream_status: Optional upstream HTTP status code.

    Returns:
        API detail payload with a stable error code and message.
    """
    detail: dict[str, object] = {
        "error": "upstream_error",
        "message": message,
    }
    if upstream_status is not None:
        detail["upstream_status"] = upstream_status
    return detail
