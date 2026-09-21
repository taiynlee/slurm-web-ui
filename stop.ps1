$root = $PSScriptRoot
$ports = @{ backend = 8020; frontend = 5174 }
$expectedPathFragment = "\workplace\slurm_webui\"

function Test-OwnedByThisProject($processId) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    if (-not $p) { return $false }
    if ($p.CommandLine -and $p.CommandLine -like "*$expectedPathFragment*") { return $true }
    $cur = $p
    for ($i = 0; $i -lt 5; $i++) {
        if (-not $cur.ParentProcessId) { break }
        $cur = Get-CimInstance Win32_Process -Filter "ProcessId=$($cur.ParentProcessId)" -ErrorAction SilentlyContinue
        if (-not $cur) { break }
        if ($cur.CommandLine -and $cur.CommandLine -like "*$expectedPathFragment*") { return $true }
    }
    return $false
}

foreach ($name in "backend", "frontend") {
    $stoppedAny = $false
    $port = $ports[$name]
    $owners = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($ownerPid in $owners) {
        if (-not (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)) { continue }
        if (Test-OwnedByThisProject $ownerPid) {
            taskkill /PID $ownerPid /T /F | Out-Null
            Write-Host "[$name] stopped port-$port owner (PID $ownerPid)"
            $stoppedAny = $true
        } else {
            Write-Host "[$name] port $port is held by a process that does NOT belong to this project (PID $ownerPid) - leaving it alone."
        }
    }

    $pidFile = Join-Path $root ".$name.pid"
    if (Test-Path $pidFile) {
        $procId = (Get-Content $pidFile).Trim()
        if ($procId -and (Get-Process -Id $procId -ErrorAction SilentlyContinue) -and (Test-OwnedByThisProject $procId)) {
            taskkill /PID $procId /T /F | Out-Null
            Write-Host "[$name] stopped recorded launch PID $procId"
            $stoppedAny = $true
        }
        Remove-Item $pidFile -Force
    }

    if (-not $stoppedAny) {
        Write-Host "[$name] nothing running."
    }
}
