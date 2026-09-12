@echo off
rem Blade Patch launcher - runs the PowerShell applier
rem Бонус: можно ПЕРЕТАЩИТЬ папку Blade на этот bat — путь подхватится сам
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0blade-update.ps1" -BladeRoot "%~1"
echo.
pause
