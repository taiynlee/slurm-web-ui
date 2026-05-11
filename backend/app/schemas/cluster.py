from typing import Any, Dict, Optional, List
from pydantic import BaseModel


class ClusterInfoResponse(BaseModel):
    controller_health: Dict[str, Any]
    node_count: int
    partition_count: int
    job_count: int
    jobs_by_state: Dict[str, int]
    node_states: Dict[str, int]
    total_gpus: int = 0
    used_gpus: int = 0
    scheduler: Dict[str, Any] = {}


class JobDetail(BaseModel):
    """Detailed job information matching Slurm REST API V0043JobInfo."""

    # Identity
    job_id: int
    name: Optional[str] = None
    state: Optional[str] = None
    state_reason: Optional[str] = None
    description: Optional[str] = None

    # User/account
    user: Optional[str] = None
    uid: Optional[int] = None
    group: Optional[str] = None
    gid: Optional[int] = None
    account: Optional[str] = None
    qos: Optional[str] = None
    partition: Optional[str] = None
    priority: Optional[int] = None
    nice: Optional[int] = None

    # Resources
    nodes: Optional[str] = None
    node_count: Optional[int] = None
    cpus: Optional[int] = None
    tasks: Optional[int] = None
    cpus_per_task: Optional[int] = None
    mem_per_cpu_mb: Optional[int] = None
    mem_per_node_mb: Optional[int] = None
    tres_req: Optional[str] = None
    tres_alloc: Optional[str] = None
    gres: Optional[str] = None
    licenses: Optional[str] = None

    # Timing
    submit_time: Optional[str] = None
    eligible_time: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    time_limit_min: Optional[int] = None
    deadline: Optional[str] = None

    # I/O paths
    work_dir: Optional[str] = None
    command: Optional[str] = None
    stdout: Optional[str] = None
    stdout_expanded: Optional[str] = None
    stderr: Optional[str] = None
    stderr_expanded: Optional[str] = None
    stdin_expanded: Optional[str] = None

    # Exit & extras
    exit_code: Optional[int] = None
    derived_exit_code: Optional[int] = None
    restarts: Optional[int] = None
    dependency: Optional[str] = None
    comment: Optional[str] = None
