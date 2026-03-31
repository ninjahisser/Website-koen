@echo off
cd /d "%~dp0"
echo Stripe login...

set "STRIPE_CMD=stripe"

where stripe >nul 2>&1
if %errorlevel% neq 0 (
	if exist "%ProgramFiles%\Stripe\stripe.exe" (
		set "STRIPE_CMD=%ProgramFiles%\Stripe\stripe.exe"
	) else if exist "%~dp0tools\stripe\stripe.exe" (
		set "STRIPE_CMD=%~dp0tools\stripe\stripe.exe"
	) else (
		echo Stripe CLI is not installed.
		echo Run 00_install_stripe_cli.bat first.
		pause
		exit /b 1
	)
)
"%STRIPE_CMD%" login
pause
