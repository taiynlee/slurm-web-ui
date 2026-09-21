# slurm_webui Start Script (hidden background mode)
# Backend: http://localhost:8020
# Frontend: http://localhost:5174

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $root "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

function Test-PortInUse($port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

function Start-Hidden($name, $port, $filePath, $arguments, $workDir) {
    if (Test-PortInUse $port) {
        Write-Host "[$name] port $port already in use, skip starting."
        return
    }
    $pidFile = Join-Path $root ".$name.pid"
    $logFile = Join-Path $logDir "$name.log"
    $errFile = Join-Path $logDir "$name.err.log"
    $p = Start-Process -FilePath $filePath -ArgumentList $arguments -WorkingDirectory $workDir `
        -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $logFile -RedirectStandardError $errFile
    $p.Id | Out-File -FilePath $pidFile -Encoding ascii -NoNewline
    Write-Host "[$name] started (hidden), PID=$($p.Id), port=$port, log=$logFile"
}

Start-Hidden -name "backend" -port 8020 `
    -filePath "uv" -arguments "run uvicorn app.main:app --reload --port 8020" `
    -workDir (Join-Path $root "backend")

Start-Hidden -name "frontend" -port 5174 `
    -filePath "cmd.exe" -arguments "/c npm run dev" `
    -workDir (Join-Path $root "frontend")
