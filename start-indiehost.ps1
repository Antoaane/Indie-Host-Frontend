$ErrorActionPreference = 'Stop'

& "$PSScriptRoot/init-indiehost.ps1"

docker compose up -d --build --wait

docker compose ps

Write-Host ''
Write-Host 'Frontend: http://localhost'
Write-Host 'API health: http://localhost/api/health'
