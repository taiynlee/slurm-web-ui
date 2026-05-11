"""
RFC 7807 Problem Details for HTTP APIs.
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel


class ProblemDetail(BaseModel):
    """RFC 7807 Problem Details response model."""
    
    type: str = "about:blank"
    title: str
    detail: Optional[str] = None
    status: int
    instance: Optional[str] = None
    extensions: Optional[Dict[str, Any]] = None