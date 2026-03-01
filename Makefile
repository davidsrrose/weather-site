.PHONY: dev dev-docker dev-docker-down prod-build prod-run setup-backend lint-backend format-backend format-check-backend test-backend dev-backend lint-frontend format-check-frontend typecheck-frontend test-frontend

# Backend quality and local API commands.
setup-backend:
	uv sync --frozen

lint-backend:
	uv run ruff check backend

format-backend:
	uv run ruff format backend

format-check-backend:
	uv run ruff format --check backend

test-backend:
	PYTHONPATH=backend/src uv run python -m unittest discover -s backend/tests -p "test_*.py" -v

dev-backend:
	PYTHONPATH=backend/src uv run uvicorn fastapi_app.main:app --reload --port 8000

# Frontend quality commands.
lint-frontend:
	pnpm -C frontend lint

format-check-frontend:
	pnpm -C frontend format:check

typecheck-frontend:
	pnpm -C frontend typecheck

test-frontend:
	pnpm -C frontend test:run

# Local dev: run backend + frontend with hot reload, then open mobile preview.
dev:
	@command -v uv >/dev/null 2>&1 || (echo "uv is required for local dev."; exit 1)
	@command -v pnpm >/dev/null 2>&1 || (echo "pnpm is required for local dev."; exit 1)
	@echo "Starting backend (8000) and frontend (5173) with hot reload..."
	@(cd backend && uv run uvicorn fastapi_app.main:app --reload --port 8000) & BACKEND_PID=$$!; \
	(pnpm -C frontend dev --host 0.0.0.0 --port 5173) & FRONTEND_PID=$$!; \
	MOBILE_PID=; \
	trap 'kill $$BACKEND_PID $$FRONTEND_PID $$MOBILE_PID >/dev/null 2>&1 || true' INT TERM EXIT; \
	echo "Waiting for frontend at http://localhost:5173 ..."; \
	until curl -sSf http://localhost:5173 >/dev/null 2>&1; do sleep 1; done; \
	(pnpm -C frontend run open:mobile) & MOBILE_PID=$$!; \
	echo "Local dev is up. Press Ctrl+C to stop."; \
	wait $$BACKEND_PID $$FRONTEND_PID

# Docker dev: run compose stack, stream logs, and auto-clean on Ctrl+C.
dev-docker:
	@set -e; \
	docker compose -f docker-compose.dev.yml up --build -d; \
	MOBILE_PID=; \
	trap 'kill $$MOBILE_PID >/dev/null 2>&1 || true; docker compose -f docker-compose.dev.yml down >/dev/null 2>&1 || true' INT TERM EXIT; \
	echo "Waiting for frontend at http://localhost:5173 ..."; \
	until curl -sSf http://localhost:5173 >/dev/null 2>&1; do sleep 1; done; \
	(pnpm -C frontend run open:mobile) & MOBILE_PID=$$!; \
	echo "Docker dev stack is up. Press Ctrl+C to stop and clean up."; \
	docker compose -f docker-compose.dev.yml logs -f

dev-docker-down:
	docker compose -f docker-compose.dev.yml down

# Production-like image helpers for local verification.
prod-build:
	docker build -t weather-site:local .

prod-run:
	docker run --rm -p 8080:8000 weather-site:local
