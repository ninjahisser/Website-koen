@echo off
cd /d "%~dp0"
echo Starting Flask backend on http://127.0.0.1:5000
"%~dp0.venv\Scripts\python.exe" "%~dp0backend\server.py"
pause
