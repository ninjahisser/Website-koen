@echo off
REM Start de portable Python-omgeving en de Flask-server

REM Zet pad naar portable Python
set PYTHON_DIR=backend\python-embed
set PYTHON_EXE=%PYTHON_DIR%\python.exe

REM Controleer of python.exe bestaat
if not exist "%PYTHON_EXE%" (
    echo Portable Python niet gevonden in %PYTHON_EXE%
    echo Download de "Windows embeddable package" van python.org en pak uit in %PYTHON_DIR%
    pause
    exit /b 1
)

REM Maak venv aan als die nog niet bestaat
if not exist backend\venv (
    echo Virtuele omgeving wordt aangemaakt...
    "%PYTHON_EXE%" -m venv backend\venv
)

REM Activeer venv en installeer requirements
call backend\venv\Scripts\activate.bat
pip install -r backend\requirements.txt

REM Start de Flask-server
cd backend
python server.py
pause
