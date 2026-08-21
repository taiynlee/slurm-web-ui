from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.cluster import ClusterInfoResponse, JobDetail
from app.services.slurm_client import slurm_client
from app.services.gpu_collector import query_history, query_node_latest, query_summary

router = APIRouter()


@router.get('/info', response_model=ClusterInfoResponse)
async def get_cluster_info():
    summary = await slurm_client.get_cluster_info()
    if summary is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail='Failed to fetch cluster summary')
    return summary


@router.get('/nodes')
async def get_nodes():
    return await slurm_client.get_nodes()


@router.get('/partitions')
async def get_partitions():
    return await slurm_client.get_partitions()


@router.get('/jobs')
async def get_jobs():
    return await slurm_client.get_jobs()


@router.get('/stats')
async def get_stats():
    return await slurm_client.get_diag()


@router.get('/history')
async def get_job_history(
    start_ts: Optional[int] = Query(None, description="Start Unix timestamp"),
    end_ts:   Optional[int] = Query(None, description="End Unix timestamp"),
    nodes:    Optional[str] = Query(None, description="Comma-separated node names"),
):
    node_list = [n.strip() for n in nodes.split(",")] if nodes else None
    return await slurm_client.get_job_history(start_ts, end_ts, node_list)


@router.get('/jobs/{job_id}', response_model=JobDetail)
async def get_job_detail(job_id: int):
    job_detail = await slurm_client.get_job_detail(job_id)
    if job_detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f'Job {job_id} not found')
    return job_detail


# ── GPU monitoring (BCM) ────────────────────────────────────────────────────

@router.get('/gpu/summary')
async def get_gpu_summary():
    nodes = await slurm_client.get_gpu_node_names()
    return query_summary(nodes)


@router.get('/gpu/nodes')
async def get_gpu_nodes():
    nodes = await slurm_client.get_gpu_node_names()
    return query_node_latest(nodes)


@router.get('/gpu/history')
async def get_gpu_history(
    entity: str = Query(..., description="Node name"),
    metric: str = Query("gpu_utilization", description="Metric prefix"),
    hours:  int = Query(24, ge=1, le=168),
):
    series = query_history(entity, metric, hours)
    return {"entity": entity, "metric": metric, "hours": hours, "series": series}


@router.get('/gpu/jobs')
async def get_gpu_jobs():
    """Return mapping of node → gpu_index → job_id from Slurm GRES detail."""
    import re
    result = await slurm_client.get_jobs()
    jobs = result.get('jobs', []) if isinstance(result, dict) else []

    mapping: dict = {}  # { node: { "0": job_id, "1": job_id, ... } }

    for job in jobs:
        job_id = job.get('job_id')
        node = job.get('nodes', '')
        gres_details = job.get('gres_detail') or []
        if not job_id or not node or not gres_details:
            continue

        gpu_indices: list[int] = []
        for gres in gres_details:
            m = re.search(r'IDX:([0-9,\-N/A]+)', str(gres))
            if not m:
                continue
            idx_str = m.group(1)
            if idx_str == 'N/A':
                continue
            for part in idx_str.split(','):
                part = part.strip()
                if '-' in part:
                    a, b = part.split('-', 1)
                    gpu_indices.extend(range(int(a), int(b) + 1))
                elif part.isdigit():
                    gpu_indices.append(int(part))

        if not gpu_indices:
            continue

        for n in node.split(','):
            n = n.strip()
            if n not in mapping:
                mapping[n] = {}
            for idx in gpu_indices:
                mapping[n][str(idx)] = job_id

    return mapping
