@echo off
setlocal enabledelayedexpansion

echo RTMP Monitor Startup Script
echo ========================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js is not installed! Please install Node.js from https://nodejs.org/
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

:: Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo npm is not installed! Please install Node.js from https://nodejs.org/
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if !ERRORLEVEL! neq 0 (
        echo Failed to install dependencies!
        echo Press any key to exit...
        pause >nul
        exit /b 1
    )
)

:: Start the application
echo Starting RTMP Monitor...
echo.
echo Access the dashboard at http://localhost:5173
echo Use rtmp://127.0.0.1:1935/live for RTMP streaming
echo.
echo Press Ctrl+C to stop the server
echo.

call npm run dev

:: If npm run dev fails
if %ERRORLEVEL% neq 0 (
    echo Failed to start the application!
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

endlocal