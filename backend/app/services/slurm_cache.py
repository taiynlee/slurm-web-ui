from cachetools import TTLCache
from threading import Lock
from typing import Any, Optional


class SlurmCache:
    """Simple thread-safe TTL cache for Slurm REST API responses."""

    def __init__(self, maxsize: int = 100, ttl: int = 15):
        self.cache = TTLCache(maxsize=maxsize, ttl=ttl)
        self.lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        with self.lock:
            return self.cache.get(key)

    def set(self, key: str, value: Any) -> None:
        with self.lock:
            self.cache[key] = value
