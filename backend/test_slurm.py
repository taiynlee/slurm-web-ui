#!/usr/bin/env python3
"""
Test script to check Slurm REST API connectivity.
"""
import httpx
import asyncio
from app.core.config import settings

async def test_slurm_connection():
    """Test connection to Slurm REST API."""
    base_url = settings.SLURM_HOST
    if not base_url.startswith(("http://", "https://")):
        base_url = f"http://{base_url.strip('/')}"

    url = f"{base_url}/slurm/{settings.SLURMRESTD_VERSION}/ping"
    headers = {
        "X-SLURM-USER-NAME": getattr(settings, "SLURM_USER", settings.SLURM_USER_NAME),
    }

    if settings.SLURM_USER_TOKEN:
        headers["X-SLURM-USER-TOKEN"] = settings.SLURM_USER_TOKEN

    print(f"Testing connection to: {url}")
    print(f"Headers: {headers}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                print("✅ Connection successful!")
                print(f"Response: {response.json()}")
            else:
                print(f"❌ Connection failed with status {response.status_code}")
                print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Connection error: {e}")

if __name__ == "__main__":
    asyncio.run(test_slurm_connection())