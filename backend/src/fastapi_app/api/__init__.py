"""FastAPI weather API routers."""

from fastapi import APIRouter

from fastapi_app.api.weather import router as weather_router

router = APIRouter()
router.include_router(weather_router)
