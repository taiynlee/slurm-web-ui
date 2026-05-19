import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.cluster import router as cluster_router
from app.core.config import settings
from app.schemas.problem import ProblemDetail
from app.services.gpu_collector import collector_loop

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(collector_loop())
    yield
    task.cancel()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description="Web UI for Slurm HPC cluster monitoring",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=ProblemDetail(
                title=exc.detail,
                detail=exc.detail,
                status=exc.status_code,
                instance=str(request.url),
            ).dict(exclude_unset=True),
        )

    app.include_router(cluster_router, prefix="/cluster", tags=["cluster"])

    @app.get("/health")
    async def health():
        return {"status": "ok", "app": settings.APP_NAME}

    # Serve built frontend — only when the static dir exists (i.e. inside Docker)
    if os.path.isdir(STATIC_DIR):
        app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa():
            return FileResponse(os.path.join(STATIC_DIR, "index.html"))

    return app


app = create_app()
