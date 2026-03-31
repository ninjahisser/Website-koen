@echo off
REM Start Flask server met .env support (python-dotenv)
REM Zet je werkdirectory op backend
cd /d %~dp0

REM Optioneel: activeer venv (indien aanwezig)
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

REM Start Flask app zodat .env automatisch wordt geladen

REM Zet FLASK_APP expliciet en start met python -m flask run
set FLASK_APP=server:app
set FLASK_ENV=development
python -m flask run

pause
