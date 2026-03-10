# ============================================================
# IndieHost - Demarrage complet de tous les services
# Usage : .\start-indiehost.ps1
# ============================================================

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$LISTINGS_MODE_API = "api"
$LISTINGS_MODE_LOCAL_JSON = "local-json"

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

    $shellExe = (Get-Process -Id $PID -ErrorAction SilentlyContinue).Path
    if (-not $shellExe) {
        $shellExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) {
            "pwsh"
        } elseif (Get-Command powershell -ErrorAction SilentlyContinue) {
            "powershell"
        } else {
            $null
        }
    }

    if (-not $shellExe) {
        Write-Fail "Impossible d'ouvrir un terminal pour $Title (pwsh/powershell introuvable)."
        exit 1
    }

    # Titre dans la barre de titre via $host.UI.RawUI.WindowTitle
    $fullCmd = "`$host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$WorkDir'; $Command"
    Start-Process $shellExe -ArgumentList "-NoExit", "-Command", $fullCmd
}

function Normalize-ListingsDataMode {
    param([AllowNull()][string]$RawMode)

    if ($null -eq $RawMode) {
        return $LISTINGS_MODE_LOCAL_JSON
    }

    $normalized = $RawMode.Trim().Trim("'").Trim('"').ToLowerInvariant()
    if ($normalized -eq $LISTINGS_MODE_API) {
        return $LISTINGS_MODE_API
    }

    return $LISTINGS_MODE_LOCAL_JSON
}

function Resolve-ListingsDataMode {
    $envPath = Join-Path $ROOT "frontend\.env"
    if (-not (Test-Path $envPath)) {
        return $LISTINGS_MODE_LOCAL_JSON
    }

    $line = Get-Content $envPath | Where-Object { $_ -match '^\s*VITE_LISTINGS_DATA_MODE\s*=' } | Select-Object -Last 1
    if (-not $line) {
        return $LISTINGS_MODE_LOCAL_JSON
    }

    $rawValue = [regex]::Match($line, '^\s*VITE_LISTINGS_DATA_MODE\s*=\s*(?<value>.*)$').Groups['value'].Value
    return Normalize-ListingsDataMode -RawMode $rawValue
}

function Ensure-PortService {
    param(
        [int]$Port,
        [string]$StepMessage,
        [string]$RunningMessage,
        [string]$WorkDir,
        [string]$Title,
        [string]$Command,
        [string]$StartedMessage
    )

    Write-Step $StepMessage
    if (Get-ListeningPid $Port) {
        Write-Ok $RunningMessage
        return
    }

    Open-Service -Title $Title -WorkDir $WorkDir -Command $Command
    Start-Sleep 1
    Write-Ok $StartedMessage
}

function Test-PrismaClientNeedsGeneration {
    param(
        [string]$ApiDir
    )

    $schemaPath = Join-Path $ApiDir "prisma\schema.prisma"
    $clientPath = Join-Path $ApiDir "node_modules\.prisma\client\index.js"

    if (-not (Test-Path $clientPath)) {
        return $true
    }

    if (-not (Test-Path $schemaPath)) {
        return $false
    }

    $schemaTime = (Get-Item $schemaPath).LastWriteTimeUtc
    $clientTime = (Get-Item $clientPath).LastWriteTimeUtc

    return $schemaTime -gt $clientTime
}

function Test-PythonModuleAvailable {
    param(
        [string]$PythonExe,
        [string]$ModuleName
    )

    & $PythonExe -c "import $ModuleName" 1>$null 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Ensure-ScrapingPythonDependencies {
    param(
        [string]$ScrapDir,
        [string]$PythonExe
    )

    $requirementsPath = Join-Path $ScrapDir "requirements.txt"
    if (-not (Test-Path $requirementsPath)) {
        Write-Fail "requirements.txt introuvable pour le service de scraping."
        exit 1
    }

    $depsStampPath = Join-Path $ScrapDir ".venv\.deps-installed"
    $needInstall = -not (Test-PythonModuleAvailable -PythonExe $PythonExe -ModuleName "uvicorn")

    if (-not $needInstall) {
        if (-not (Test-Path $depsStampPath)) {
            $needInstall = $true
        } else {
            $requirementsTime = (Get-Item $requirementsPath).LastWriteTimeUtc
            $stampTime = (Get-Item $depsStampPath).LastWriteTimeUtc
            $needInstall = $requirementsTime -gt $stampTime
        }
    }

    if (-not $needInstall) {
        Write-Ok "Dependances Python du scraping deja a jour."
        return
    }

    Write-Warn "Installation des dependances Python du scraping..."
    & $PythonExe -m pip install -r $requirementsPath
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "L'installation des dependances Python a echoue."
        exit 1
    }

    Set-Content -Path $depsStampPath -Value (Get-Date).ToString("o")
    Write-Ok "Dependances Python du scraping a jour."
}

function Start-ApiInfraServices {
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

}

function Start-BackendApiService {
    Write-Step "Demarrage du Backend API..."
    if (Get-ListeningPid 4000) {
        Write-Ok "Backend API deja actif (localhost:4000)."
        return
    }

    $apiDir = Join-Path $ROOT "backend\api"
    $apiEnvFile = Join-Path $apiDir ".env"
    $apiEnvExampleFile = Join-Path $apiDir ".env.example"
    Push-Location $apiDir
    try {
        if (-not (Test-Path $apiEnvFile)) {
            if (-not (Test-Path $apiEnvExampleFile)) {
                Write-Fail "Fichier .env.example introuvable pour le backend API."
                exit 1
            }

            Write-Warn "Fichier .env introuvable pour le backend. Copie depuis .env.example..."
            Copy-Item $apiEnvExampleFile $apiEnvFile
            Write-Ok "Fichier .env cree pour le backend API."
        }

        if (Test-PrismaClientNeedsGeneration -ApiDir $apiDir) {
            Write-Warn "Generation du client Prisma pour le backend..."
            $prismaOk = $false
            for ($attempt = 1; $attempt -le 2; $attempt++) {
                & npm run prisma:generate
                if ($LASTEXITCODE -eq 0) {
                    $prismaOk = $true
                    break
                }

                if ($attempt -lt 2) {
                    Write-Warn "Generation Prisma en echec (tentative $attempt/2). Nouvelle tentative dans 2s..."
                    Start-Sleep 2
                }
            }

            if (-not $prismaOk) {
                Write-Fail "La generation du client Prisma a echoue."
                Write-Warn "Si tu vois une erreur EPERM sur query_engine-windows.dll.node, ferme les process Node/Prisma deja ouverts puis relance."
                exit 1
            }

            Write-Ok "Client Prisma genere pour le backend."
        } else {
            Write-Ok "Client Prisma deja a jour pour le backend."
        }
    } finally {
        Pop-Location
    }
    Open-Service -Title "IndieHost API :4000" -WorkDir $apiDir -Command "npm run dev"
    Start-Sleep 1
    Write-Ok "Backend API lance dans un nouvel onglet (localhost:4000)."
}

$listingsMode = Resolve-ListingsDataMode
$apiMode = $listingsMode -eq $LISTINGS_MODE_API

Write-Step "Mode de donnees annonces: $listingsMode"
if ($apiMode) {
    Write-Ok "Mode API detecte: PostgreSQL + Backend API seront demarres."
} else {
    Write-Ok "Mode local-json detecte: PostgreSQL ignore, Backend API lance pour la console."
}

if ($apiMode) {
    Start-ApiInfraServices
}

Start-BackendApiService

# ── 4. Scraping (:8000) ───────────────────────────────────────
Write-Step "Demarrage du serveur de scraping..."

if (Get-ListeningPid 8000) {
    Write-Ok "Serveur de scraping deja actif (localhost:8000)."
} else {
    $scrapDir  = Join-Path $ROOT "backend\microservices\microservice-scraping-py"
    $pythonExe = Join-Path $scrapDir ".venv\Scripts\python.exe"
    if (-not (Test-Path $pythonExe)) {
        Write-Warn "Environnement Python introuvable. Initialisation automatique du .venv..."
        Push-Location $scrapDir
        try {
            if (Get-Command python -ErrorAction SilentlyContinue) {
                & python -m venv .venv
            } elseif (Get-Command py -ErrorAction SilentlyContinue) {
                & py -3 -m venv .venv
            } else {
                Write-Fail "Python est introuvable. Installe Python 3.10+ puis relance le script."
                exit 1
            }

            if (-not (Test-Path $pythonExe)) {
                Write-Fail "La creation du .venv a echoue pour le service de scraping."
                exit 1
            }
        } finally {
            Pop-Location
        }
    }

    Ensure-ScrapingPythonDependencies -ScrapDir $scrapDir -PythonExe $pythonExe

    $scrapCmd  = "& '$pythonExe' -m uvicorn api:app --reload --port 8000"
    Open-Service -Title "IndieHost Scraping :8000" -WorkDir $scrapDir -Command $scrapCmd
    Start-Sleep 1
    Write-Ok "Serveur de scraping lance dans un nouvel onglet (localhost:8000)."
}

# ── 5. Frontend (:5179) ───────────────────────────────────────
$frontDir = Join-Path $ROOT "frontend"
Ensure-PortService `
    -Port 5179 `
    -StepMessage "Demarrage du Frontend..." `
    -RunningMessage "Frontend deja actif (localhost:5179)." `
    -WorkDir $frontDir `
    -Title "IndieHost Frontend :5179" `
    -Command "npm run dev" `
    -StartedMessage "Frontend lance dans un nouvel onglet (localhost:5179)."

# ── Recap ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "  IndieHost - Tous les services actifs  " -ForegroundColor White
Write-Host "========================================" -ForegroundColor DarkCyan
if ($apiMode) {
    Write-Host "  PostgreSQL  localhost:5432" -ForegroundColor Gray
} else {
    Write-Host "  PostgreSQL  desactive (mode $LISTINGS_MODE_LOCAL_JSON)" -ForegroundColor DarkGray
}
Write-Host "  API         http://localhost:4000" -ForegroundColor Gray
Write-Host "  Scraping    http://localhost:8000" -ForegroundColor Gray
Write-Host "  Frontend    http://localhost:5179" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host ""
