# slurm_webui — Claude Context

## Project

Slurm Web UI: a FastAPI backend + React/TanStack Router frontend for browsing Slurm HPC cluster status.

No authentication — the app is open-access. The backend exists solely to proxy Slurm REST API requests and hide the Slurm JWT token from the browser.

## Repository Layout

```
slurm_webui/
├── backend/
│   ├── app/
│   │   ├── api/cluster/       # Route handlers
│   │   ├── core/config.py     # pydantic-settings (Slurm vars only)
│   │   ├── schemas/           # Pydantic response models
│   │   └── services/          # slurm_client.py, slurm_cache.py
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── routes/            # TanStack Router file-based pages
│   │   ├── components/        # GaugeChart, Tooltip, ErrorBoundary
│   │   ├── hooks/useCluster.ts
│   │   └── lib/               # api.ts (axios), slurm.ts (helpers)
│   └── package.json
└── .env                       # Slurm credentials
```

## Development Environment

- Python managed with **uv**:
  ```bash
  cd backend && uv run uvicorn app.main:app --reload --port 8001
  ```
- Frontend:
  ```bash
  cd frontend && npm run dev
  ```

## Key Architecture Decisions

### Slurm TTL Cache
`backend/app/services/slurm_cache.py` — `cachetools.TTLCache` (ttl=60s).
Cache is keyed by endpoint name. Keeps slurmrestd load low and matches the 1-minute frontend polling interval.

### No Auth
All `/cluster/*` endpoints are public. The Slurm token is kept server-side in `.env` and never sent to the browser.

### API Conventions
- All endpoints return raw Slurm data (or a derived summary for `/cluster/info`).
- Error responses follow RFC 7807 Problem Details.

### Frontend Conventions
- TanStack Router **file-based routing** — pages live under `src/routes/`
- Tailwind CSS for all styling
- `lucide-react` for icons
- `src/lib/api.ts` — plain axios instance (no auth interceptor)
- `src/hooks/useCluster.ts` — polling hook (60 s interval, stale-while-revalidate via `hasData` ref)

## Environment Variables

`backend/.env`:

```
SLURM_HOST=http://<host>:6820
SLURM_USER_NAME=root
SLURM_USER_TOKEN=<slurm-jwt>
SLURMRESTD_VERSION=v0.0.42
```
