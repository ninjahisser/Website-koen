$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envFile)) {
    Write-Error "Kon .env niet vinden op: $envFile"
}

Write-Host "Haal Stripe webhook secret op..." -ForegroundColor Cyan

$listenOutput = stripe listen --print-secret 2>&1

$secretMatch = [regex]::Match($listenOutput, "whsec_[A-Za-z0-9]+")
if (-not $secretMatch.Success) {
    Write-Host "Kon geen webhook secret detecteren. Zet STRIPE_WEBHOOK_SECRET handmatig." -ForegroundColor Yellow
    Write-Output $listenOutput
    exit 1
}

$secret = $secretMatch.Value

$content = Get-Content $envFile -Raw
if ($content -match "(?m)^STRIPE_WEBHOOK_SECRET=") {
    $content = [regex]::Replace($content, "(?m)^STRIPE_WEBHOOK_SECRET=.*$", "STRIPE_WEBHOOK_SECRET=$secret")
} else {
    $content = $content.TrimEnd() + "`r`nSTRIPE_WEBHOOK_SECRET=$secret`r`n"
}

Set-Content -Path $envFile -Value $content -Encoding UTF8
Write-Host "Webhook secret opgeslagen in backend/.env" -ForegroundColor Green
Write-Host "Run daarna de task 'Stripe: listen local webhook' om events door te sturen." -ForegroundColor Green
