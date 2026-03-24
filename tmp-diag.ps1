Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*sdk-url*' } |
  ForEach-Object {
    $cmd = if ($_.CommandLine.Length -gt 300) { $_.CommandLine.Substring(0, 300) } else { $_.CommandLine }
    Write-Host "PID: $($_.ProcessId) | Parent: $($_.ParentProcessId) | CPU: $([math]::Round(($_.KernelModeTime + $_.UserModeTime)/10000000, 1))s"
    Write-Host "  CMD: $cmd"
    Write-Host ""
  }
