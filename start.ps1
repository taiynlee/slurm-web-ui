# slurm_webui Start Script
# Backend: http://localhost:8020
# Frontend: http://localhost:5174

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== Starting slurm_webui ===" -ForegroundColor Cyan

# Start backend
Write-Host "[1/2] Starting backend (port 8020)..." -ForegroundColor Yellow
$backendDir = Join-Path $root "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; uv run uvicorn app.main:app --reload --port 8020" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start frontend
Write-Host "[2/2] Starting frontend (port 5174)..." -ForegroundColor Yellow
$frontendDir = Join-Path $root "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "=== slurm_webui Started ===" -ForegroundColor Green
Write-Host "  Backend  -> http://localhost:8020" -ForegroundColor White
Write-Host "  Frontend -> http://localhost:5174" -ForegroundColor White
