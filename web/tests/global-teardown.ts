/**
 * Playwright global teardown — kills all processes on test server ports
 * after every test run, preventing orphaned sockets.
 *
 * Ports killed: TEST_PORT (API server) + 5174 (Vite HMR)
 * Ports NOT killed: 3456/3457 (user dev server, untouched)
 */
import { execSync } from "node:child_process";

const TEST_PORTS = [Number(process.env.PORT) || 3458, 5174];

function killPort(port: number): void {
  try {
    if (process.platform === "win32") {
      execSync(
        `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue }"`,
        { stdio: "ignore", timeout: 5000 }
      );
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, {
        stdio: "ignore",
        timeout: 5000,
        shell: true,
      });
    }
  } catch {
    // Ignore — port was already free or process already gone
  }
}

export default async function globalTeardown(): Promise<void> {
  for (const port of TEST_PORTS) {
    killPort(port);
  }
}
