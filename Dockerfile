# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

RUN corepack enable

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build


FROM python:3.13-slim AS backend-builder
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.10.7 /uv /uvx /bin/

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project


FROM python:3.13-slim AS runtime
WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:${PATH}"
ENV PYTHONPATH="/app/backend:/app/backend/src"

COPY --from=backend-builder /app/.venv /app/.venv
COPY backend/src/ /app/backend/src/
COPY backend/config.py /app/backend/config.py
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 8000

CMD ["sh", "-c", "uvicorn fastapi_app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
