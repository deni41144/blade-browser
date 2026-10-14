@echo off
chcp 65001 >nul
title Сборка Blade Setup v2.0
cd /d "%~dp0"
echo ========================================================
echo       СБОРКА BLADE SETUP v2.0 (C# WPF / .NET 9)
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

echo [1/2] Компиляция и публикация Blade-Setup.exe (Single-File, win-x64)...
dotnet publish BladeSetup.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o "Output"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ОШИБКА] Сборка завершилась с ошибкой!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Сборка успешно завершена!
echo Файл: %~dp0Output\Blade-Setup.exe
echo.
echo Для выпуска офлайн-установщика с уже встроенным Firefox запустите:
echo powershell -ExecutionPolicy Bypass -File "..\New-Blade-Release.ps1" -Version 2.3.6
echo.
pause
