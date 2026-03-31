@echo off
cd /d "%~dp0"
echo Saving Stripe webhook secret to backend/.env ...
powershell -ExecutionPolicy Bypass -File "%~dp0backend\stripe_listen_and_set_secret.ps1"
pause
