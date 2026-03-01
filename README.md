# Weather.gov (but better)
Website to replicate weather.gov's hourly weather forecast graphs, but with a mobile-friendly and modern UI.

## Overview
This repository is a POC monorepo for ingesting weather data and presenting it in a modern web experience.

## Repository Structure

```text
.
├── backend/                # Website backend, 100% python
│   ├── src/                # Python source root
│   │   └── fastapi_app/    # Backend FastAPI application package
│   │       ├── routes/     # FastAPI route modules (HTTP endpoints)
│   │       └── services/   # App services + infrastructure helpers
│   ├── config.py           # Non-secret runtime config defaults
│   └── README.md           # Backend readme
├── frontend/               # Vite + React + TypeScript client app
├── docs/                   # Project docs
├── AGENTS.md               # Contributor guidance for Python/code style
├── Makefile                # Dev, lint, and format command entrypoints
├── pyproject.toml          # Repo Python project config + dependencies
├── uv.lock                 # Locked Python dependency versions
└── README.md               # Monorepo overview
```


## Setup Docs
Service-level setup instructions live in each subproject README.

## Local Development
Ports:
- Backend API: `8000`
- Frontend app: `5173`

Preferred (non-docker, fastest while coding):
```bash
make dev
```

What it does:
- Starts backend + frontend locally with hot reload
- Opens a Playwright mobile preview window (iPhone emulation) at `http://localhost:5173`
- Frontend API proxy target: `http://localhost:8000`
- Frontend config var: `VITE_API_PROXY_TARGET`

Docker dev mode:
```bash
make dev-docker
```

What it does:
- Builds and starts Dockerized backend + frontend dev services
- Enables hot reload for both services
- Opens a Playwright mobile preview window (iPhone emulation) at `http://localhost:5173`
- Frontend API proxy target: `http://backend:8000` (Docker service name)
- Frontend config var: `VITE_API_PROXY_TARGET`
- Stays attached to logs; `Ctrl+C` automatically runs cleanup (`docker compose ... down`)

Playwright one-time setup (required before first mobile launch):
```bash
pnpm -C frontend exec playwright install chromium
```

Stop Docker dev services:
```bash
make dev-docker-down
```

## Docker (Single Command)
Run one command from repo root to build and launch the full app (API + UI served by FastAPI):

```bash
docker build -t weather-site:local .
docker run --rm -p 8080:8000 weather-site:local
```

Open:
- `http://localhost:8080`
- `http://localhost:8080/api/health`

`$PORT` behavior:
- In deployed environments (for example Render), the container binds to `$PORT`.
- Locally, if `$PORT` is not set, it falls back to port `8000` inside the container.
- Local mapping example above (`-p 8080:8000`) continues to work without setting `$PORT`.

Makefile shortcuts:
```bash
make prod-build
make prod-run
```

## CI Image Publish
GitHub Actions workflow publishes container images to GHCR on push:
- `main`: `prod`, `latest`, `sha-<shortsha>`
- `staging`: `stg`, `sha-<shortsha>`

## Full Tech Stack
| Tool | Purpose | Install |
| --- | --- | --- |
| [Homebrew](https://brew.sh/) | Package manager | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| [Python 3.13](https://www.python.org/) | Runtime | `brew install python@3.13` |
| [Node.js 24+](https://nodejs.org/) | Frontend runtime + package ecosystem | `brew install node` |
| [uv](https://astral.sh/uv/) | Virtual env + package manager | `brew install uv` |
| [Git](https://git-scm.com/) | Version control | `brew install git` |
| [FastAPI](https://fastapi.tiangolo.com/) | Backend API framework | `n/a, managed by uv` |
| [Uvicorn](https://www.uvicorn.org/) | ASGI server for FastAPI | `n/a, managed by uv` |
| [dlt](https://dlthub.com/) | Data ingestion/loading framework | `n/a, managed by uv` |
| [DuckDB](https://duckdb.org/) | Local database engine | `brew install duckdb` |
| [Vite](https://vitejs.dev/) | Frontend build tool + dev server | `cd frontend && npm install vite` |
| [React](https://react.dev/) | Frontend UI framework | `cd frontend && npm install react react-dom` |
| [TypeScript](https://www.typescriptlang.org/) | Static typing for frontend code | `cd frontend && npm install -D typescript` |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling | `cd frontend && npm install -D tailwindcss postcss autoprefixer` |
| [shadcn/ui](https://ui.shadcn.com/) | Component primitives for React UI | `cd frontend && npx shadcn@latest init` |
| [TanStack Query](https://tanstack.com/query/latest) | Server-state fetching and caching | `cd frontend && npm install @tanstack/react-query` |
| [Docker](https://www.docker.com/) | Containerized local/dev runtime | `brew install --cask docker` |