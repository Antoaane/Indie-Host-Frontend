$ErrorActionPreference = 'Stop'

& "$PSScriptRoot/init-indiehost.ps1"
Set-Location $PSScriptRoot

function Read-EnvValue {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Test-Path -LiteralPath '.env')) {
    return ''
  }

  foreach ($line in Get-Content -LiteralPath '.env') {
    if ($line -match "^\s*#") { continue }
    if ($line -match "^\s*$([regex]::Escape($Name))=(.*)$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }

  return ''
}

docker compose run --rm preflight

$sslDomain = Read-EnvValue -Name 'SSL_DOMAIN'
$sslEmail = Read-EnvValue -Name 'SSL_EMAIL'
$cloudflarePropagationSeconds = Read-EnvValue -Name 'CLOUDFLARE_DNS_PROPAGATION_SECONDS'
if ([string]::IsNullOrWhiteSpace($cloudflarePropagationSeconds)) {
  $cloudflarePropagationSeconds = '30'
}

$certPath = Join-Path $PSScriptRoot "certbot/conf/live/$sslDomain/fullchain.pem"
if (-not (Test-Path -LiteralPath $certPath -PathType Leaf)) {
  Write-Host "[certbot] Aucun certificat initial trouve pour $sslDomain. Generation DNS-01 Cloudflare..."
  docker compose run --rm --entrypoint certbot certbot certonly `
    --dns-cloudflare `
    --dns-cloudflare-credentials /run/secrets/cloudflare.ini `
    --dns-cloudflare-propagation-seconds $cloudflarePropagationSeconds `
    -d $sslDomain `
    -d "*.$sslDomain" `
    --email $sslEmail `
    --agree-tos `
    --no-eff-email `
    --non-interactive
}
else {
  Write-Host "[certbot] Certificat existant conserve pour $sslDomain"
}

docker compose up -d --build --wait

docker compose ps

Write-Host ''
Write-Host "Frontend: https://$sslDomain"
Write-Host "API health: https://$sslDomain/api/health"
Write-Host "Scraping health (interne, non exposé) : docker compose ps scraping"
