# Kill all processes on ports 5174 and 5175
foreach ($port in 3456, 3457, 5174, 5175) {
    $pids = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
    if ($pids) {
        foreach ($procId in $pids) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "Killing PID $procId ($($proc.ProcessName)) on port $port"
                Stop-Process -Id $procId -Force
            }
        }
    } else {
        Write-Host "No process found on port $port"
    }
}
