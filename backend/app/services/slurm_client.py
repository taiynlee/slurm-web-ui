"""
Slurm REST API client with caching support.
"""
import httpx
import re
from collections import Counter
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.services.slurm_cache import SlurmCache


class SlurmClient:
    """Async HTTP client for Slurm REST API."""

    def __init__(self):
        base_url = settings.SLURM_HOST
        if not base_url.startswith(("http://", "https://")):
            base_url = f"http://{base_url.strip('/')}"

        self.base_url = base_url.rstrip('/')
        self.user = getattr(settings, "SLURM_USER", settings.SLURM_USER_NAME)
        self.token = settings.SLURM_USER_TOKEN
        self.cache = SlurmCache(maxsize=100, ttl=60)

    def _get_headers(self) -> Dict[str, str]:
        """Build HTTP headers with Slurm authentication."""
        headers = {
            "X-SLURM-USER-NAME": self.user,
        }
        if self.token:
            headers["X-SLURM-USER-TOKEN"] = self.token
        return headers

    async def _cached_get(self, cache_key: str, path: str) -> Dict[str, Any]:
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}{path}",
                    headers=self._get_headers(),
                    timeout=15.0,
                )
                # slurmrestd may return 511 even with valid data in the body;
                # only treat truly non-parseable responses as errors.
                result = response.json()
                self.cache.set(cache_key, result)
                return result
            except Exception as e:
                return {"error": str(e)}

    async def ping(self) -> Dict[str, Any]:
        """Ping Slurm REST API."""
        return await self._cached_get("ping", f"/slurm/{settings.SLURMRESTD_VERSION}/ping")

    async def get_jobs(self) -> Dict[str, Any]:
        """Get all jobs from Slurm."""
        return await self._cached_get("jobs", f"/slurm/{settings.SLURMRESTD_VERSION}/jobs")

    async def get_partitions(self) -> Dict[str, Any]:
        """Get all partitions from Slurm, falling back to node-derived data on error."""
        result = await self._cached_get("partitions", f"/slurm/{settings.SLURMRESTD_VERSION}/partitions")
        if isinstance(result, dict) and "error" in result:
            # slurmrestd partitions endpoint unavailable — derive from node data
            nodes_result = await self.get_nodes()
            nodes = nodes_result.get("nodes", []) if isinstance(nodes_result, dict) else []
            return self._partitions_from_nodes(nodes)
        return result

    def _partitions_from_nodes(self, nodes: list) -> Dict[str, Any]:
        """Build a minimal partitions response from node membership data."""
        part_nodes: Dict[str, list] = {}
        for node in nodes:
            if not isinstance(node, dict):
                continue
            parts = node.get("partitions", [])
            if isinstance(parts, str):
                parts = [parts]
            for p in (parts or []):
                if p not in part_nodes:
                    part_nodes[p] = []
                part_nodes[p].append(node)

        partitions = []
        for pname, pnodes in part_nodes.items():
            total_cpus = sum(n.get("cpus", 0) for n in pnodes)
            gres_parts = [n.get("gres", "") for n in pnodes if n.get("gres")]
            tres_cfg = f"cpu={total_cpus},node={len(pnodes)}"
            if gres_parts:
                m = re.search(r'gpu(?::[a-zA-Z_]+)?:(\d+)', gres_parts[0], re.I)
                if m:
                    total_gpu = sum(
                        int(re.search(r'gpu(?::[a-zA-Z_]+)?:(\d+)', g, re.I).group(1))
                        for g in gres_parts
                        if re.search(r'gpu(?::[a-zA-Z_]+)?:(\d+)', g, re.I)
                    )
                    tres_cfg += f",gres/gpu={total_gpu}"
            partitions.append({
                "name": pname,
                "partition": {"state": ["UP"]},
                "nodes": {"total": len(pnodes), "configured": ",".join(n.get("name","") for n in pnodes)},
                "cpus": {"total": total_cpus},
                "tres": {"configured": tres_cfg},
                "maximums": {"time": {"set": False, "infinite": True, "number": 0}},
                "defaults": {"time": {"set": False, "infinite": True, "number": 0}, "job": ""},
                "qos": {"assigned": "", "allowed": ""},
                "priority": None,
            })
        return {"partitions": partitions}

    async def get_nodes(self) -> Dict[str, Any]:
        """Get all nodes from Slurm."""
        return await self._cached_get("nodes", f"/slurm/{settings.SLURMRESTD_VERSION}/nodes")

    async def get_diag(self) -> Dict[str, Any]:
        """Get scheduler diagnostics from Slurm."""
        return await self._cached_get("diag", f"/slurm/{settings.SLURMRESTD_VERSION}/diag")

    async def get_cluster_info(self) -> Dict[str, Any]:
        """Compose a summary payload from multiple Slurm endpoints."""
        ping_result = await self.ping()
        nodes_result = await self.get_nodes()
        partitions_result = await self.get_partitions()
        jobs_result = await self.get_jobs()

        nodes = []
        if isinstance(nodes_result, dict):
            nodes = nodes_result.get("nodes") or nodes_result.get("data") or []
        elif isinstance(nodes_result, list):
            nodes = nodes_result

        partitions = []
        if isinstance(partitions_result, dict):
            partitions = partitions_result.get("partitions") or partitions_result.get("data") or []
        elif isinstance(partitions_result, list):
            partitions = partitions_result

        jobs = []
        if isinstance(jobs_result, dict):
            jobs = jobs_result.get("jobs") or jobs_result.get("data") or []
        elif isinstance(jobs_result, list):
            jobs = jobs_result

        jobs_by_state = Counter()
        for job in jobs:
            if isinstance(job, dict):
                # Slurm v0.0.42 uses "job_state" (array); older versions use "state" or "JobState"
                s = job.get("job_state") or job.get("state") or job.get("JobState") or "unknown"
                if isinstance(s, list):
                    s = s[0] if s else "unknown"
                jobs_by_state[str(s).upper()] += 1

        node_states = Counter()
        for node in nodes:
            if isinstance(node, dict):
                s = node.get("state") or node.get("NodeState") or "unknown"
                if isinstance(s, list):
                    s = s[0] if s else "unknown"
                node_states[str(s).lower()] += 1

        # GPU aggregate from node gres strings
        total_gpus = 0
        used_gpus = 0
        for node in nodes:
            if isinstance(node, dict):
                # handles both "gpu:8" and "gpu:nvidia:8(S:0-1)"
                m = re.search(r'gpu(?::[a-zA-Z_]+)?:(\d+)', str(node.get("gres", "")), re.I)
                if m:
                    total_gpus += int(m.group(1))
                m2 = re.search(r'gres/gpu=(\d+)', str(node.get("tres_used", "")), re.I)
                if m2:
                    used_gpus += int(m2.group(1))

        diag_result = await self.get_diag()
        stats = diag_result.get("statistics", {}) if isinstance(diag_result, dict) else {}

        return {
            "controller_health": ping_result,
            "node_count": len(nodes),
            "partition_count": len(partitions),
            "job_count": len(jobs),
            "jobs_by_state": dict(jobs_by_state),
            "node_states": dict(node_states),
            "total_gpus": total_gpus,
            "used_gpus": used_gpus,
            "scheduler": {
                "jobs_running":   stats.get("jobs_running", 0),
                "jobs_pending":   stats.get("jobs_pending", 0),
                "jobs_submitted": stats.get("jobs_submitted", 0),
                "jobs_completed": stats.get("jobs_completed", 0),
                "jobs_failed":    stats.get("jobs_failed", 0),
                "schedule_cycle_mean": stats.get("schedule_cycle_mean", 0),
                "bf_cycle_last":       stats.get("bf_cycle_last", 0),
                "server_thread_count": stats.get("server_thread_count", 0),
            },
        }

    def _exit_code(self, job: Dict[str, Any]) -> Optional[int]:
        """Extract exit code from job data."""
        if "exit_code" in job:
            return job["exit_code"]
        if "derived_exit_code" in job:
            return job["derived_exit_code"]
        return None

    def _map_job_detail(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """Map Slurm V0043JobInfo to JobDetail format."""
        return {
            "job_id": job.get("job_id") or job.get("JobId"),
            "name": job.get("name") or job.get("JobName"),
            "state": job.get("state") or job.get("JobState"),
            "state_reason": job.get("state_reason") or job.get("StateReason"),
            "description": job.get("description") or job.get("JobDescription"),

            "user": job.get("user") or job.get("User"),
            "uid": job.get("uid") or job.get("UserId"),
            "group": job.get("group") or job.get("Group"),
            "gid": job.get("gid") or job.get("GroupId"),
            "account": job.get("account") or job.get("Account"),
            "qos": job.get("qos") or job.get("QOS"),
            "partition": job.get("partition") or job.get("Partition"),
            "priority": job.get("priority") or job.get("Priority"),
            "nice": job.get("nice") or job.get("Nice"),

            "nodes": job.get("nodes") or job.get("NodeList"),
            "node_count": job.get("node_count") or job.get("NodeCount"),
            "cpus": job.get("cpus") or job.get("NumCPUs"),
            "tasks": job.get("tasks") or job.get("NumTasks"),
            "cpus_per_task": job.get("cpus_per_task") or job.get("CPUsPerTask"),
            "mem_per_cpu_mb": job.get("mem_per_cpu_mb"),
            "mem_per_node_mb": job.get("mem_per_node_mb"),
            "tres_req": job.get("tres_req") or job.get("TresReqStr"),
            "tres_alloc": job.get("tres_alloc") or job.get("TresAllocStr"),
            "gres": job.get("gres") or job.get("Gres"),
            "licenses": job.get("licenses") or job.get("Licenses"),

            "submit_time": job.get("submit_time") or job.get("SubmitTime"),
            "eligible_time": job.get("eligible_time") or job.get("EligibleTime"),
            "start_time": job.get("start_time") or job.get("StartTime"),
            "end_time": job.get("end_time") or job.get("EndTime"),
            "time_limit_min": job.get("time_limit_min") or job.get("TimeLimit"),
            "deadline": job.get("deadline") or job.get("Deadline"),

            "work_dir": job.get("work_dir") or job.get("WorkDir"),
            "command": job.get("command") or job.get("Command"),
            "stdout": job.get("stdout") or job.get("StdOut"),
            "stdout_expanded": job.get("stdout_expanded"),
            "stderr": job.get("stderr") or job.get("StdErr"),
            "stderr_expanded": job.get("stderr_expanded"),
            "stdin_expanded": job.get("stdin_expanded"),

            "exit_code": self._exit_code(job),
            "derived_exit_code": job.get("derived_exit_code") or job.get("DerivedExitCode"),
            "restarts": job.get("restarts") or job.get("RestartCnt"),
            "dependency": job.get("dependency") or job.get("Dependency"),
            "comment": job.get("comment") or job.get("Comment"),
        }

    async def get_job_detail(self, job_id: int) -> Optional[Dict[str, Any]]:
        """Get detailed information for a specific job from cached job list."""
        jobs_result = await self.get_jobs()

        jobs = []
        if isinstance(jobs_result, dict):
            jobs = jobs_result.get("jobs") or jobs_result.get("data") or []
        elif isinstance(jobs_result, list):
            jobs = jobs_result

        for job in jobs:
            if isinstance(job, dict):
                current_job_id = job.get("job_id") or job.get("JobId")
                if current_job_id == job_id:
                    return self._map_job_detail(job)

        return None


    async def get_job_history(
        self,
        start_ts: Optional[int] = None,
        end_ts: Optional[int] = None,
        nodes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Query historical jobs from slurmdbd, filtered by time range and nodes."""
        params: Dict[str, Any] = {}
        if start_ts:
            params["start_time"] = start_ts
        if end_ts:
            params["end_time"] = end_ts

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/slurmdb/{settings.SLURMRESTD_VERSION}/jobs",
                    headers=self._get_headers(),
                    params=params,
                    timeout=30.0,
                )
                data = response.json()
            except Exception as e:
                return {"error": str(e), "jobs": []}

        jobs = data.get("jobs", [])

        target_nodes = set(nodes) if nodes else {"aidgxapp01", "aidgxapp02"}
        filtered = [
            j for j in jobs
            if any(n in str(j.get("nodes", "")) for n in target_nodes)
        ]

        seen: Dict[int, Dict] = {}
        for j in filtered:
            t = j.get("time", {})
            tres = j.get("tres", {})
            allocated = tres.get("allocated", [])
            cpus = next((x["count"] for x in allocated if x.get("type") == "cpu"), None)
            gpus = next((x["count"] for x in allocated if x.get("type") == "gres" and x.get("name") == "gpu"), None)

            state_list = j.get("state", {}).get("current", [])
            state = (state_list[-1] if state_list else "UNKNOWN").upper()

            job_id = j.get("job_id")
            record = {
                "job_id":    job_id,
                "name":      j.get("name"),
                "user":      j.get("user"),
                "nodes":     j.get("nodes"),
                "partition": j.get("partition"),
                "state":     state,
                "cpus":      cpus,
                "gpus":      gpus,
                "submit_time": t.get("submission"),
                "start_time":  t.get("start"),
                "end_time":    t.get("end"),
                "elapsed":     t.get("elapsed"),
            }
            # Deduplicate: keep the entry with the latest end_time (most complete record)
            if job_id not in seen or (t.get("end") or 0) >= (seen[job_id].get("end_time") or 0):
                seen[job_id] = record

        return {"jobs": list(seen.values()), "errors": data.get("errors", [])}


# Global Slurm client instance
slurm_client = SlurmClient()
