@echo off
REM Zet een virtuele omgeving op en start de Flask server met de juiste packages
cd /d %~dp0

REM 1. Maak venv aan als die nog niet bestaat
if not exist venv (
    echo Virtuele omgeving wordt aangemaakt...
    python -m venv venv
)

REM 2. Activeer venv
call venv\Scripts\activate.bat

REM 3. Installeer dependencies indien nodig
pip install --upgrade pip
pip install flask stripe

REM 4. Start Flask server
set FLASK_APP=server:app
set FLASK_ENV=development
python -m flask run

pause
