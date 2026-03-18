$ErrorActionPreference = 'Stop'

function Copy-IfMissing {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  if (-not (Test-Path -LiteralPath $Destination)) {
    Copy-Item -LiteralPath $Source -Destination $Destination
    Write-Host "[init] Created $Destination"
  }
  else {
    Write-Host "[init] Kept existing $Destination"
  }
}

Copy-IfMissing -Source '.env.example' -Destination '.env'

if (-not (Test-Path -LiteralPath 'secrets')) {
  New-Item -ItemType Directory -Path 'secrets' | Out-Null
}

Copy-IfMissing -Source 'secret.example/database_url.example.txt' -Destination 'secrets/database_url.txt'
Copy-IfMissing -Source 'secret.example/stripe_secret_key.example.txt' -Destination 'secrets/stripe_secret_key.txt'
Copy-IfMissing -Source 'secret.example/stripe_webhook_secret.example.txt' -Destination 'secrets/stripe_webhook_secret.txt'
Copy-IfMissing -Source 'secret.example/clerk_secret_key.example.txt' -Destination 'secrets/clerk_secret_key.txt'
Copy-IfMissing -Source 'secret.example/gandi_api_token.example.txt' -Destination 'secrets/gandi_api_token.txt'
Copy-IfMissing -Source 'secret.example/imagekit_api_key.example.txt' -Destination 'secrets/imagekit_api_key.txt'
Copy-IfMissing -Source 'secret.example/scrapfly_api_key.example.txt' -Destination 'secrets/scrapfly_api_key.txt'

Write-Host ''
Write-Host '[init] Next step: edit .env + secrets/*.txt with real values, then run ./start-indiehost.ps1'
