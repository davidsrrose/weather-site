"""Compatibility shim for legacy app.api imports."""

from fastapi_app.api import router

__all__ = ["router"]
