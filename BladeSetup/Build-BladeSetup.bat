@echo off
chcp 65001 >nul
title Сборка Blade Setup v2.0
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
dotnet publish BladeSetup.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o "..\Installer\Output"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ОШИБКА] Сборка завершилась с ошибкой!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Сборка успешно завершена!
echo Файл: ..\Installer\Output\Blade-Setup.exe
echo.
echo Теперь положите data.zip рядом с Blade-Setup.exe в папке:
echo ..\Installer\Output\
echo.
pause
