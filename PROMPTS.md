# slurm_webui — Development Prompts

## 目標

在這個 folder 建立一個系統，叫做 slurm_webui。

這個系統是一個 Slurm HPC 叢集監控介面，不需要使用者登入。

## 參考

https://slurm.schedmd.com/rest_api.html
.env file

## 功能

### Feature #1 — Slurm Cluster 監控
- 查看 Slurm Cluster 的 profile 與 info
- 流程：ui → frontend → backend (cache via TTL) → slurmrestd
- Backend 使用 60 秒 TTL cache 保留從 slurmrestd 取得的內容

### Feature #2 — Job 詳細資訊
- Job 列表顯示等待時間、運行時間、剩餘時間
- 點擊 Job 進入詳細頁面

## Backend Core Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend Framework | FastAPI | API proxy |
| HTTP Client | httpx | Slurm REST API calls |
| Cache | cachetools TTLCache | 60s TTL per endpoint |
| Settings | pydantic-settings | .env loading |
| Server | Uvicorn | ASGI server |

## Frontend Core Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | TanStack Router + React | SPA routing |
| Build Tool | Vite | Development & build |
| Styling | Tailwind CSS | Utility-first CSS |
| Icons | lucide-react | Icon library |
| HTTP | axios | API calls |

## Architecture

```
Browser → React SPA → FastAPI proxy → slurmrestd
```

The backend hides the Slurm JWT token. No authentication layer.
