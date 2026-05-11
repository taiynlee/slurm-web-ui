from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.cluster import ClusterInfoResponse, JobDetail
from app.services.slurm_client import slurm_client

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
