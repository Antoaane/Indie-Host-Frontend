# ============================================================
# IndieHost - Demarrage complet de tous les services
# Usage : .\start-indiehost.ps1
# ============================================================

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step { param($msg) Write-Host "" ; Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "   [!!] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "   [KO] $msg" -ForegroundColor Red }

function Get-ListeningPid {
    param([int]$Port)
    $line = netstat -ano 2>$null | Where-Object { $_ -match ":$Port\s" -and $_ -match "LISTENING" } | Select-Object -First 1
    if ($line) { return ($line -split '\s+')[-1] }
    return $null
}

function Open-Service {
    param(
        [string]$Title,
        [string]$WorkDir,
        [string]$Command
    )
    # Titre dans la barre de titre via $host.UI.RawUI.WindowTitle
    $fullCmd = "`$host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$WorkDir'; $Command"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $fullCmd
}

# ── 1. Docker Desktop ────────────────────────────────────────
Write-Step "Verification de Docker Desktop..."

$dockerOk = $false
try {
    $null = docker info 2>&1
    $dockerOk = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $dockerOk) {
    Write-Warn "Docker Desktop n'est pas demarre. Tentative de lancement..."
    $candidates = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    )
    $dockerExe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($dockerExe) {
        Start-Process $dockerExe
        Write-Warn "Attente du demarrage de Docker (30s max)..."
        for ($i = 0; $i -lt 10; $i++) {
            Start-Sleep 3
            try { $null = docker info 2>&1; if ($LASTEXITCODE -eq 0) { $dockerOk = $true; break } } catch {}
        }
    }
}

if ($dockerOk) {
    Write-Ok "Docker Desktop actif."
} else {
    Write-Fail "Docker Desktop inaccessible. Lance-le manuellement puis relance ce script."
    exit 1
}

# ── 2. PostgreSQL ─────────────────────────────────────────────
Write-Step "Demarrage de PostgreSQL..."

$pgId = docker ps --filter "name=indiehost-postgres" --filter "status=running" -q 2>$null
if ($pgId) {
    Write-Ok "PostgreSQL deja actif (localhost:5432)."
} else {
    Push-Location (Join-Path $ROOT "docker")
    docker compose up -d postgres | Out-Null
    Pop-Location
    Start-Sleep 2
    Write-Ok "PostgreSQL demarre (localhost:5432)."
}

# ── 3. Backend API (:4000) ────────────────────────────────────
Write-Step "Demarrage du Backend API..."

if (Get-ListeningPid 4000) {
    Write-Ok "Backend API deja actif (localhost:4000)."
} else {
    $apiDir = Join-Path $ROOT "backend\api"
    Open-Service -Title "IndieHost API :4000" -WorkDir $apiDir -Command "npm run dev"
    Start-Sleep 1
    Write-Ok "Backend API lance dans un nouvel onglet (localhost:4000)."
}

# ── 4. Scraping (:8000) ───────────────────────────────────────
Write-Step "Demarrage du serveur de scraping..."

if (Get-ListeningPid 8000) {
    Write-Ok "Serveur de scraping deja actif (localhost:8000)."
} else {
    $scrapDir  = Join-Path $ROOT "backend\microservices\microservice-scraping-py"
    $pythonExe = Join-Path $scrapDir ".venv\Scripts\python.exe"
    $scrapCmd  = "& '$pythonExe' -m uvicorn api:app --reload --port 8000"
    Open-Service -Title "IndieHost Scraping :8000" -WorkDir $scrapDir -Command $scrapCmd
    Start-Sleep 1
    Write-Ok "Serveur de scraping lance dans un nouvel onglet (localhost:8000)."
}

# ── 5. Frontend (:5179) ───────────────────────────────────────
Write-Step "Demarrage du Frontend..."

if (Get-ListeningPid 5179) {
    Write-Ok "Frontend deja actif (localhost:5179)."
} else {
    $frontDir = Join-Path $ROOT "frontend"
    Open-Service -Title "IndieHost Frontend :5179" -WorkDir $frontDir -Command "npm run dev"
    Start-Sleep 1
    Write-Ok "Frontend lance dans un nouvel onglet (localhost:5179)."
}

# ── Recap ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "  IndieHost - Tous les services actifs  " -ForegroundColor White
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "  PostgreSQL  localhost:5432" -ForegroundColor Gray
Write-Host "  API         http://localhost:4000" -ForegroundColor Gray
Write-Host "  Scraping    http://localhost:8000" -ForegroundColor Gray
Write-Host "  Frontend    http://localhost:5179" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host ""
