import base64
import httpx
import tempfile
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from app.core.config import settings

_backend_dir = Path(__file__).parent.parent.parent

# Write base64 certs to temp files once at import time so we don't create
# a new pair of files on every request.
_tmp_cert_path: Optional[str] = None
_tmp_key_path:  Optional[str] = None

if settings.BCM_CERT_B64 and settings.BCM_KEY_B64:
    _tf_cert = tempfile.NamedTemporaryFile(suffix='.pem', delete=False)
    _tf_cert.write(base64.b64decode(settings.BCM_CERT_B64))
    _tf_cert.flush(); _tf_cert.close()
    _tmp_cert_path = _tf_cert.name

    _tf_key = tempfile.NamedTemporaryFile(suffix='.pem', delete=False)
    _tf_key.write(base64.b64decode(settings.BCM_KEY_B64))
    _tf_key.flush(); _tf_key.close()
    _tmp_key_path = _tf_key.name


def _cert() -> Optional[Tuple[str, str]]:
    if _tmp_cert_path and _tmp_key_path:
        return (_tmp_cert_path, _tmp_key_path)
    cert = _backend_dir / settings.BCM_CERT_PATH
    key  = _backend_dir / settings.BCM_KEY_PATH
    if cert.exists() and key.exists():
        return (str(cert), str(key))
    return None


class BcmClient:
    def __init__(self):
        self.base = settings.BCM_HOST.rstrip('/')

    async def _get(self, path: str, params: Dict = None) -> Any:
        async with httpx.AsyncClient(cert=_cert(), verify=False) as client:
            r = await client.get(f"{self.base}{path}", params=params, timeout=15.0)
            return r.json()

    async def get_latest(self, entity: str = None) -> List[Dict]:
        params = {}
        if entity:
            params['entity'] = entity
        data = await self._get('/rest/v1/monitoring/latest/', params)
        return data.get('data', []) if isinstance(data, dict) else []

    async def get_summary(self) -> Dict:
        data = await self.get_latest(entity='base')
        m = {d['measurable']: d['raw'] for d in data}
        return {
            'total_gpus':        _num(m.get('GPUsTotal')),
            'gpus_up':           _num(m.get('GPUsUp')),
            'total_util_pct':    _pct(m.get('TotalGPUUtilization')),
            'total_mem_util_pct': _pct(m.get('TotalGPUMemoryUtilization')),
            'total_power_w':     _num(m.get('TotalGPUPowerUsage')),
        }


def _num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _pct(v) -> float:
    n = _num(v)
    return round(n * 100, 1) if n is not None and n <= 1.0 else n


bcm_client = BcmClient()
