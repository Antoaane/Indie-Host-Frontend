$ErrorActionPreference = 'Stop'

function Normalize-SecretPath {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  if (Test-Path -LiteralPath $Destination -PathType Container) {
    Write-Error @"
[init][error] $Destination est un dossier, mais un fichier est attendu.
[init][error] Par securite, ce script ne supprime jamais automatiquement des dossiers ou des secrets.
[init][error] Inspecte ce dossier, sauvegarde son contenu si necessaire, puis renomme-le ou supprime-le manuellement avant de relancer.
[init][error] Template attendu: $Source
"@
  }
}

function Copy-IfMissing {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  Normalize-SecretPath -Source $Source -Destination $Destination

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
Copy-IfMissing -Source 'secret.example/clerk_secret_key.example.txt' -Destination 'secrets/clerk_secret_key.txt'
Copy-IfMissing -Source 'secret.example/imagekit_api_key.example.txt' -Destination 'secrets/imagekit_api_key.txt'
Copy-IfMissing -Source 'secret.example/cloudflare.ini.example' -Destination 'secrets/cloudflare.ini'

Write-Host ''
Write-Host '[init] Next step: edit .env + secrets/*.txt with real values, then run ./start-indiehost.ps1'
