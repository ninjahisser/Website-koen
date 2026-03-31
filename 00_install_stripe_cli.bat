@echo off
cd /d "%~dp0"
echo Installing Stripe CLI...

set "STRIPE_EXE="

where stripe >nul 2>&1
if %errorlevel%==0 (
  echo Stripe CLI is already installed.
  stripe --version
  pause
  exit /b 0
)

if exist "%ProgramFiles%\Stripe\stripe.exe" (
  set "STRIPE_EXE=%ProgramFiles%\Stripe\stripe.exe"
  echo Stripe CLI found at %STRIPE_EXE%
  "%STRIPE_EXE%" --version
  pause
  exit /b 0
)

where winget >nul 2>&1
if %errorlevel%==0 (
  echo Using winget to install Stripe CLI...
  winget search stripe
  winget install --id Stripe.StripeCli -e --source winget
  where stripe >nul 2>&1
  if %errorlevel%==0 (
    echo Installation complete.
    stripe --version
    pause
    exit /b 0
  )
  if exist "%ProgramFiles%\Stripe\stripe.exe" (
    echo Installation complete at %ProgramFiles%\Stripe\stripe.exe
    "%ProgramFiles%\Stripe\stripe.exe" --version
    pause
    exit /b 0
  )
  echo Winget package not found or install failed. Trying MSI installer...
)

echo Installing Stripe CLI via MSI fallback...
powershell -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $tmp = Join-Path $env:TEMP 'stripe_cli_setup.msi'; Invoke-WebRequest -Uri 'https://github.com/stripe/stripe-cli/releases/latest/download/stripe_windows_x86_64.msi' -OutFile $tmp; Start-Process msiexec.exe -Wait -ArgumentList '/i', $tmp, '/qn'"

where stripe >nul 2>&1
if %errorlevel%==0 (
  echo Installation complete.
  stripe --version
  pause
  exit /b 0
)

if exist "%ProgramFiles%\Stripe\stripe.exe" (
  echo Installation complete at %ProgramFiles%\Stripe\stripe.exe
  "%ProgramFiles%\Stripe\stripe.exe" --version
  pause
  exit /b 0
)

echo Stripe CLI is still not available in PATH.
echo Restart your PC or sign out/sign in, then run this file again.
echo Manual docs: https://stripe.com/docs/stripe-cli
pause
exit /b 1
