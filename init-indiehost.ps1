$ErrorActionPreference = 'Stop'

function Normalize-SecretPath {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  if (Test-Path -LiteralPath $Destination -PathType Container) {
    $sourceName = [System.IO.Path]::GetFileName($Source)
    $preferredCandidate = Join-Path $Destination $sourceName
    $candidate = $null

    if (Test-Path -LiteralPath $preferredCandidate -PathType Leaf) {
      $candidate = $preferredCandidate
    }
    else {
      $files = Get-ChildItem -LiteralPath $Destination -File -Force
      if ($files.Count -eq 1) {
        $candidate = $files[0].FullName
      }
    }

    $tmpFile = [System.IO.Path]::GetTempFileName()
    if ($null -ne $candidate) {
      Copy-Item -LiteralPath $candidate -Destination $tmpFile -Force
      Write-Host "[init] Replaced directory by file $Destination (preserved content from $candidate)"
    }
    else {
      Copy-Item -LiteralPath $Source -Destination $tmpFile -Force
      Write-Host "[init] Replaced directory by file $Destination (template reapplied from $Source)"
    }

    Remove-Item -LiteralPath $Destination -Recurse -Force
    Move-Item -LiteralPath $tmpFile -Destination $Destination -Force
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
Copy-IfMissing -Source 'secret.example/gandi_api_token.example.txt' -Destination 'secrets/gandi_api_token.txt'
Copy-IfMissing -Source 'secret.example/imagekit_api_key.example.txt' -Destination 'secrets/imagekit_api_key.txt'

Write-Host ''
Write-Host '[init] Next step: edit .env + secrets/*.txt with real values, then run ./start-indiehost.ps1'
