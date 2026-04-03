@echo off
REM Git Push Script for Website-koen (Windows)
REM Run this batch file to quickly push changes to GitHub

setlocal enabledelayedexpansion

echo.
echo ==========================================
echo Website-koen - Git Push Script
echo ==========================================
echo.

REM Check if git is available
where git >nul 2>nul
if errorlevel 1 (
    echo Error: Git is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if we're in a git repository
if not exist .git (
    echo Error: Not in a git repository. Run this from the project root.
    pause
    exit /b 1
)

REM Show git status
echo Current status:
git status --short
echo.

REM Get commit message from user
set /p commit_message="Commit message: "

if "!commit_message!"=="" (
    echo Error: Commit message cannot be empty
    pause
    exit /b 1
)

REM Add all changes
echo.
echo Staging changes...
git add .

REM Commit changes
echo Creating commit...
git commit -m "!commit_message!"
if errorlevel 1 (
    echo Note: Nothing to commit ^(working tree clean^)
)

REM Push to GitHub
echo.
echo Pushing to GitHub...
git push
if errorlevel 1 (
    echo Error: Push failed. Check your connection and credentials.
    pause
    exit /b 1
)

echo.
echo Successfully pushed to GitHub!
echo.
pause
