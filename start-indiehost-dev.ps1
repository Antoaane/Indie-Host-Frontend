$ErrorActionPreference = 'Stop'

& "$PSScriptRoot/init-indiehost.ps1"

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait

docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

Write-Host ''
Write-Host 'Dev Frontend (via nginx): http://localhost'
Write-Host 'Dev Frontend (direct Vite): http://localhost:5179'
Write-Host 'API health: http://localhost/api/health'
Write-Host 'Scraping health: http://localhost/scraping/health'
