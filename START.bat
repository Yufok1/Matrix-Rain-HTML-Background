@echo off
echo ========================================
echo   Matrix Rain - CLEAN VERSION
echo ========================================
echo.
echo Cleaning up old processes...

REM Kill any existing Python HTTP servers
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *http.server*" 2>nul
taskkill /F /IM python.exe /FI "MEMUSAGE gt 1" 2>nul

REM Wait for processes to terminate
timeout /t 1 /nobreak > nul

echo Starting fresh server on port 8000...
echo.

REM Start the Python server in background
start /B python -m http.server 8000

REM Wait for server to initialize
timeout /t 2 /nobreak > nul

REM Generate random cache buster
set /a timestamp=%RANDOM%%RANDOM%

REM Open browser with fresh cache
start http://localhost:8000/matrix-rain-utility-suite.html?v=%timestamp%

echo.
echo ✅ Server running at http://localhost:8000
echo ✅ Browser opened with fresh cache (v=%timestamp%)
echo.
echo CLOSE OLD TABS! Use the new tab that just opened.
echo Close this window or press Ctrl+C to stop the server.
echo.
pause

REM Cleanup on exit
echo.
echo Stopping server...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *http.server*" 2>nul

