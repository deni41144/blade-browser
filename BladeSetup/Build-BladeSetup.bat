@echo off
chcp 65001 >nul
title Сборка Blade Setup 1.4.4 — предпросмотр интерфейса
cd /d "%~dp0"
echo ========================================================
echo       BLADE SETUP 1.4.4 — ПРЕДПРОСМОТР ИНТЕРФЕЙСА
echo ========================================================
echo.

:: Check dotnet SDK
dotnet --list-sdks >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ОШИБКА] .NET SDK не найден!
    echo Установите .NET 9 SDK:
    echo   winget install Microsoft.DotNet.SDK.9
    echo.
    pause
    exit /b 1
)

echo [1/2] Компиляция UI-preview (без встроенного движка Firefox)...
dotnet publish BladeSetup.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o "Output-Preview"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ОШИБКА] Сборка завершилась с ошибкой!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Сборка успешно завершена!
echo Файл: %~dp0Output-Preview\Blade-Setup.exe
echo.
echo Это окно не содержит браузер. Для полного релиза со встроенным движком запустите:
echo powershell -ExecutionPolicy Bypass -File "..\New-Blade-Release.ps1" -Version ^<версия^>
echo.
pause
