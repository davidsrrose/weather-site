from pathlib import Path
import logging

from fastapi import FastAPI
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

from fastapi_app.routes import router as routes_router
from config import config
from fastapi_app.services.duckdb import ensure_duckdb_parent_dir

logger = logging.getLogger("uvicorn.error")


class SPAStaticFiles(StaticFiles):
    """Static files handler that falls back to index.html for SPA routes."""

    async def get_response(self, path: str, scope):  # type: ignore[override]
        """Return static response, falling back to index.html on unknown paths."""
        if path == "api" or path.startswith("api/"):
            return await super().get_response(path, scope)
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            return await super().get_response("index.html", scope)


app = FastAPI(title="Weather Site Backend")
app.include_router(routes_router, prefix="/api")

REPO_ROOT = Path(__file__).resolve().parents[3]
FRONTEND_DIST_DIR = REPO_ROOT / "frontend" / "dist"

if FRONTEND_DIST_DIR.exists():
    app.mount("/", SPAStaticFiles(directory=FRONTEND_DIST_DIR, html=True), name="frontend")
else:
    logger.info("frontend_dist_missing path=%s", FRONTEND_DIST_DIR)


@app.on_event("startup")
def on_startup() -> None:
    ensure_duckdb_parent_dir(config.duckdb_path)
