@echo off
SETLOCAL EnableDelayedExpansion

echo ============================================================
echo  LeaderPrism Local Dev Startup Script
echo ============================================================

:: 1. Clean up ports
echo.
echo [1/7] Cleaning up local ports: 3000 (Web), 3001 (API), 3002 (Marketing), 5432 (Postgres), 6379 (Redis)...
powershell -NoProfile -Command ^
  "$ports = @(3000, 3001, 3002, 5432, 6379);" ^
  "if (Get-Command docker -ErrorAction SilentlyContinue) {" ^
  "  $containers = docker ps --format '{{.ID}} {{.Ports}}';" ^
  "  if ($LASTEXITCODE -eq 0) {" ^
  "    foreach ($line in $containers) {" ^
  "      if ($line -match '^(\S+)\s+(.*)$') {" ^
  "        $id = $Matches[1];" ^
  "        $portsInfo = $Matches[2];" ^
  "        foreach ($port in $ports) {" ^
  "          if ($portsInfo -match ('(?::|\b)' + $port + '\b')) {" ^
  "            Write-Host ('Stopping Docker container {0} blocking port {1}...' -f $id, $port) -ForegroundColor Yellow;" ^
  "            docker stop $id | Out-Null;" ^
  "          }" ^
  "        }" ^
  "      }" ^
  "    }" ^
  "  }" ^
  "}" ^
  "foreach ($port in $ports) {" ^
  "  $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue;" ^
  "  if ($conn) {" ^
  "    $pids = $conn.OwningProcess | Select-Object -Unique;" ^
  "    foreach ($pid in $pids) {" ^
  "      if ($pid -and $pid -ne 0 -and $pid -ne 4) {" ^
  "        Write-Host ('Killing process {0} on port {1}...' -f $pid, $port) -ForegroundColor Yellow;" ^
  "        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue;" ^
  "      }" ^
  "    }" ^
  "  }" ^
  "}"

:: 2. Check and copy env files
echo.
echo [2/7] Checking environment files...
if not exist .env (
    echo .env not found at root, copying from .env.example...
    copy .env.example .env >nul
) else (
    echo .env exists at root.
)

if not exist api\.env (
    echo api/.env not found, copying from api/.env.example...
    copy api\.env.example api\.env >nul
) else (
    echo api/.env exists.
)

if not exist web\.env.local (
    echo web/.env.local not found, copying from web/.env.example...
    copy web\.env.example web\.env.local >nul
) else (
    echo web/.env.local exists.
)

:: 3. Check and install dependencies
echo.
echo [3/7] Checking dependencies...
if not exist node_modules (
    echo node_modules not found, running npm install...
    call npm install
) else (
    echo node_modules folder exists.
)

:: 4. Clean up Docker
echo.
echo [4/7] Cleaning up existing Docker containers and volumes...
call docker compose down -v
if %errorlevel% neq 0 (
    powershell -NoProfile -Command "Write-Host 'Warning: docker compose down failed. Attempting to continue...' -ForegroundColor Yellow"
)

:: 5. Start Database and Redis
echo.
echo [5/7] Starting Database and Redis containers...
call docker compose up db redis -d
if %errorlevel% neq 0 (
    powershell -NoProfile -Command "Write-Host 'Error: Failed to start docker containers!' -ForegroundColor Red"
    exit /b %errorlevel%
)

:: 6. Wait for Database and Redis to be ready
echo.
echo [6/7] Waiting for Database (5432) and Redis (6379) ports to be ready...
powershell -NoProfile -Command ^
  "$ports = @(5432, 6379);" ^
  "foreach ($port in $ports) {" ^
  "  $ready = $false;" ^
  "  $attempts = 0;" ^
  "  while (-not $ready -and $attempts -lt 30) {" ^
  "    try {" ^
  "      $socket = New-Object System.Net.Sockets.TcpClient('localhost', $port);" ^
  "      $socket.Close();" ^
  "      $ready = $true;" ^
  "      Write-Host \"Port $port is active and listening.\" -ForegroundColor Green;" ^
  "    } catch {" ^
  "      $attempts++;" ^
  "      Start-Sleep -Seconds 1;" ^
  "    }" ^
  "  }" ^
  "  if (-not $ready) {" ^
  "    Write-Host \"Error: Port $port did not become active in time.\" -ForegroundColor Red;" ^
  "    exit 1;" ^
  "  }" ^
  "}"

if %errorlevel% neq 0 (
    exit /b %errorlevel%
)

:: Give PostgreSQL container extra 2 seconds to complete running init.sql
echo Waiting a brief moment for database initialization...
timeout /t 3 /nobreak >nul

:: 7. Build shared library, run migrations and seeds
echo.
echo [7/7] Building shared library and initializing database...

echo Building shared library...
call npm run build -w shared
if %errorlevel% neq 0 (
    powershell -NoProfile -Command "Write-Host 'Error: Failed to build shared library!' -ForegroundColor Red"
    exit /b %errorlevel%
)

echo Running database migrations...
call npm run db:migrate
if %errorlevel% neq 0 (
    powershell -NoProfile -Command "Write-Host 'Error: Database migrations failed!' -ForegroundColor Red"
    exit /b %errorlevel%
)

echo Running database seeds...
call npm run db:seed
if %errorlevel% neq 0 (
    powershell -NoProfile -Command "Write-Host 'Error: Database seeding failed!' -ForegroundColor Red"
    exit /b %errorlevel%
)

echo.
echo ============================================================
powershell -NoProfile -Command "Write-Host '🚀 Setup complete! Starting development servers...' -ForegroundColor Green"
echo ============================================================
echo.

powershell -NoProfile -Command "Write-Host 'API: http://localhost:3001  Web: http://localhost:3000  Marketing: http://localhost:3002' -ForegroundColor Cyan"

call npm run dev
