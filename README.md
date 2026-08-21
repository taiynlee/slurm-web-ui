# Slurm Web UI

A modern web interface for monitoring Slurm HPC clusters. No login required — open the browser and view live cluster data.

## Features

- **Real-time Cluster Overview** — node health, GPU utilisation, job counts, scheduler stats
- **Nodes** — per-node state, CPU/GPU allocation, memory, features
- **Partitions** — resource limits, node membership
- **Jobs** — queue view with wait time, runtime, remaining time; clickable job detail page
- **Job History** — slurmdbd-backed job history with time range and node filtering (up to 1 month)
- **GPU Utilization** — live per-node GPU/VRAM usage, temperature and power via BCM, with 7-day history charts
- **Light/Dark theme toggle**
- **1-minute auto-refresh** with no page flash (stale-while-revalidate)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend language | Python |
| Backend framework | FastAPI |
| Backend package manager | uv |
| Config / validation | pydantic-settings |
| TTL cache | cachetools |
| Frontend language | TypeScript |
| Frontend framework | React |
| Routing | TanStack Router (file-based) |
| Styling | Tailwind CSS |
| HTTP client | Axios |
| Icons | lucide-react |
| Bundler | Vite |

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

# GPU monitoring (BCM) — optional, only needed for the GPU Utilization page
BCM_HOST=https://<bcm-host>:8081
BCM_CERT_PATH=certs/bcm_cert.pem      # or BCM_CERT_B64 (base64-encoded PEM)
BCM_KEY_PATH=certs/bcm_key.pem        # or BCM_KEY_B64  (base64-encoded PEM)
GPU_DB_PATH=gpu_metrics.db
```

GPU-capable nodes are discovered live from Slurm (`gres` contains `gpu` and node state isn't `DOWN`) — there is no separate node list to configure or keep in sync.

## Architecture

```
Browser → React SPA (Vite) → FastAPI proxy → slurmrestd
                                    ↓
                              BCM (GPU metrics, polled every 60s into SQLite)
```

The FastAPI backend proxies all Slurm REST API requests with a **60-second TTL cache** to avoid hammering slurmrestd. The Slurm token never reaches the browser. GPU metrics are polled from BCM in the background and stored locally (SQLite) so the GPU Utilization page can serve history without re-querying BCM per request.

## Project Layout

```
slurm_webui/
├── backend/
│   ├── app/
│   │   ├── api/cluster/       # GET /cluster/{info,nodes,partitions,jobs,stats,history,gpu/*}
│   │   ├── core/config.py     # pydantic-settings
│   │   ├── schemas/           # Pydantic response models
│   │   └── services/          # slurm_client.py, slurm_cache.py, bcm_client.py, gpu_collector.py
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── routes/            # TanStack Router pages (cluster-overview, nodes, partitions, jobs, history, gpu)
│   │   ├── components/        # GaugeChart, Tooltip, ErrorBoundary
│   │   ├── hooks/useCluster.ts
│   │   └── lib/               # api.ts, slurm.ts
│   └── package.json
└── .env                       # Slurm credentials (gitignored)
```

## API Reference by Page

### Overview (`/`)

| 來源 | Method | Endpoint | 用途 |
|------|--------|----------|------|
| slurmrestd | `GET` | `/cluster/info` | 叢集摘要：節點數、工作數、GPU 統計、控制器健康、排程器指標 |
| slurmrestd | `GET` | `/cluster/jobs` | 完整工作列表，用於各狀態下的工作明細展開 |
| slurmrestd | `GET` | `/cluster/nodes` | 完整節點列表，用於各狀態下的節點名稱展開 |

### Nodes (`/nodes`)

| 來源 | Method | Endpoint | 用途 |
|------|--------|----------|------|
| slurmrestd | `GET` | `/cluster/nodes` | 所有節點的狀態、CPU／GPU 配置、記憶體資訊 |

### Partitions (`/partitions`)

| 來源 | Method | Endpoint | 用途 |
|------|--------|----------|------|
| slurmrestd | `GET` | `/cluster/partitions` | 所有 partition 的資源限制與設定 |
| slurmrestd | `GET` | `/cluster/nodes` | 用於顯示各 partition 的節點成員清單 |

### Jobs (`/jobs`)

| 來源 | Method | Endpoint | 用途 |
|------|--------|----------|------|
| slurmrestd | `GET` | `/cluster/jobs` | 目前佇列中所有工作的狀態、等待時間、執行時間 |

### Job Detail (`/jobs/:id`)

| 來源 | Method | Endpoint | 用途 |
|------|--------|----------|------|
| slurmrestd | `GET` | `/cluster/jobs/{job_id}` | 單一工作的完整詳細資訊 |

### Job History (`/history`)

| 來源 | Method | Endpoint | 用途 |
|------|--------|----------|------|
| slurmrestd / slurmdbd | `GET` | `/cluster/history` | 歷史工作記錄，透過 slurmdbd 查詢，支援時間範圍與節點篩選 |

### GPU Utilization (`/gpu`)

| 來源 | Method | Endpoint | 用途 |
|------|--------|----------|------|
| BCM (SQLite) | `GET` | `/cluster/gpu/summary` | 叢集 GPU 總覽：上線數、平均使用率、VRAM、總耗電 |
| BCM (SQLite) | `GET` | `/cluster/gpu/nodes` | 各節點最新 GPU／VRAM 使用率、溫度、耗電 |
| BCM (SQLite) | `GET` | `/cluster/gpu/history` | 指定節點的 GPU 指標時序資料（最長 7 天，伺服器端降採樣） |
| slurmrestd | `GET` | `/cluster/gpu/jobs` | 從 Slurm GRES detail 解析各節點每張 GPU 對應的 job ID |
| slurmrestd | `GET` | `/cluster/nodes` | 取得 CPU 核心數與記憶體配置，顯示於 Node 卡片 |
