# Slurm Web UI

A modern web interface for monitoring Slurm HPC clusters. No login required — open the browser and view live cluster data.

## Features

- **Real-time Cluster Overview** — node health, GPU utilisation, job counts, scheduler stats
- **Nodes** — per-node state, CPU/GPU allocation, memory, features
- **Partitions** — resource limits, node membership
- **Jobs** — queue view with wait time, runtime, remaining time; clickable job detail page
- **1-minute auto-refresh** with no page flash (stale-while-revalidate)

## Quick Start

### Prerequisites

- Python 3.13+ with [uv](https://github.com/astral-sh/uv)
- Node.js 18+
- Slurm cluster with `slurmrestd` running

### 1 — Configure

Copy and edit the backend env file:

```bash
cp backend/.env.example backend/.env
# fill in SLURM_HOST, SLURM_USER_NAME, SLURM_USER_TOKEN
```

### 2 — Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8001
```

### 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

## Configuration

`backend/.env`:

```
SLURM_HOST=http://<host>:6820
SLURM_USER_NAME=<slurm-account>
SLURM_USER_TOKEN=<slurm-jwt-token>
SLURMRESTD_VERSION=v0.0.42
```

## Architecture

```
Browser → React SPA (Vite) → FastAPI proxy → slurmrestd
```

The FastAPI backend proxies all Slurm REST API requests with a **60-second TTL cache** to avoid hammering slurmrestd. The Slurm token never reaches the browser.

## Project Layout

```
slurm_webui/
├── backend/
│   ├── app/
│   │   ├── api/cluster/       # GET /cluster/{info,nodes,partitions,jobs,stats}
│   │   ├── core/config.py     # pydantic-settings
│   │   ├── schemas/           # Pydantic response models
│   │   └── services/          # slurm_client.py + slurm_cache.py
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── routes/            # TanStack Router pages
│   │   ├── components/        # GaugeChart, Tooltip, ErrorBoundary
│   │   ├── hooks/useCluster.ts
│   │   └── lib/               # api.ts, slurm.ts
│   └── package.json
└── .env                       # Slurm credentials (gitignored)
```
