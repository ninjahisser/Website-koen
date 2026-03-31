pause
@echo off
REM Start venv en Flask server met opgegeven python.exe
set PYTHON_EXE="C:\Users\sethv\AppData\Local\Programs\Python\Python312\python.exe"
cd /d %~dp0

REM 1. Maak venv aan als die nog niet bestaat
if not exist venv (
    echo Virtuele omgeving wordt aangemaakt...
    %PYTHON_EXE% -m venv venv
)

REM 2. Installeer dependencies met expliciet pad naar python.exe in venv
venv\Scripts\python.exe -m pip install --upgrade pip
venv\Scripts\python.exe -m pip install -r requirements.txt

REM 3. Start Flask server met expliciet pad
set FLASK_APP=server:app
set FLASK_ENV=development
venv\Scripts\python.exe -m flask run

