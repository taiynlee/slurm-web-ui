# slurm_webui — Implementation Plan

## Completed Milestones

### Milestone 1 — Project Scaffolding
- [x] FastAPI backend with pydantic-settings, httpx, cachetools
- [x] React + Vite + TanStack Router + Tailwind CSS frontend
- [x] Health check endpoint `GET /health`

### Milestone 2 — Slurm Cluster API Proxy
- [x] `SlurmClient` — httpx-based Slurm REST API client
- [x] `SlurmCache` — TTLCache (60 s) keyed by endpoint name
- [x] `GET /cluster/info` — combined summary (ping + nodes + jobs + scheduler stats)
- [x] `GET /cluster/nodes` — node list
- [x] `GET /cluster/partitions` — partition list (with fallback derived from node data)
- [x] `GET /cluster/jobs` — job list
- [x] `GET /cluster/jobs/{job_id}` — job detail

### Milestone 3 — Frontend Pages
- [x] Overview — cluster health gauge, node/GPU utilisation, live job counts, scheduler stats
- [x] Nodes — table with state, CPU/GPU allocation, memory, features
- [x] Partitions — cards with resource limits and node membership list
- [x] Jobs — table with wait time, runtime, remaining time; clickable job detail page
- [x] Job Detail — full field listing (resources, timing, I/O paths, exit info)

### Milestone 4 — UX Polish
- [x] Tooltips on every metric label and column header
- [x] Chinese titles on all section headers
- [x] No-flash background refresh (stale-while-revalidate pattern)
- [x] 1-minute polling interval
- [x] Controller health reflected in cluster health gauge colour (amber = backup down)
- [x] GPU card hidden when cluster has no GPUs

### Milestone 5 — Auth Removal
- [x] Removed login/register pages and JWT auth from frontend
- [x] Removed auth/admin API routers from backend
- [x] Removed SQLite DB, SQLModel, Alembic, python-jose, passlib
- [x] Simplified backend to pure Slurm proxy (no user management)
