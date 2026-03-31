@echo off
REM Gebruik het volledige pad naar python.exe voor jouw systeem
set PYTHON_EXE="C:\Program Files\Python311\python.exe"
cd /d %~dp0

REM 1. Maak venv aan als die nog niet bestaat
if not exist venv (
    echo Virtuele omgeving wordt aangemaakt...
    %PYTHON_EXE% -m venv venv
)

REM 2. Activeer venv
call venv\Scripts\activate.bat

REM 3. Installeer dependencies indien nodig
%PYTHON_EXE% -m pip install --upgrade pip
%PYTHON_EXE% -m pip install flask stripe

REM 4. Start Flask server
set FLASK_APP=server:app
set FLASK_ENV=development
%PYTHON_EXE% -m flask run

pause
