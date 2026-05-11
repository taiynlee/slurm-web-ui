from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = Path(__file__).parent.parent.parent   # backend/
_root_dir    = _backend_dir.parent                   # slurm_webui/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_backend_dir / ".env"), str(_root_dir / ".env")),
        case_sensitive=True,
        extra="ignore",
    )

    SLURM_HOST:          str = "http://localhost:6820"
    SLURM_USER_NAME:     str = "root"
    SLURM_USER_TOKEN:    str = ""
    SLURMRESTD_VERSION:  str = "v0.0.42"
    APP_NAME:            str = "slurm_webui"


settings = Settings()
