@echo off

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ========================================
    echo   REQUESTING ADMINISTRATOR PRIVILEGES
    echo ========================================
    echo This script needs admin rights to stop Ollama service.
    echo.
    powershell -Command "Start-Process '%~f0' -Verb RunAs -WorkingDirectory '%~dp0'"
    exit /b
)

REM Change to script directory (important when running as admin)
cd /d "%~dp0"

echo ========================================
echo   Matrix Rain - OLLAMA TRANSLATION SYSTEM
echo ========================================
echo Running with Administrator privileges...
echo Working directory: %CD%
echo.
echo Cleaning up old processes...

REM Stop Ollama Windows service if running
echo Stopping Ollama service...
net stop "Ollama Service" 2>nul
sc stop Ollama 2>nul

echo Waiting for Ollama service to stop...
timeout /t 3 /nobreak > nul

REM Kill any existing Ollama processes
echo Killing Ollama processes...
taskkill /F /IM ollama.exe 2>nul
taskkill /F /IM ollama_llama_server.exe 2>nul

REM Kill any existing Python servers
echo Killing all Python processes...
taskkill /F /IM python.exe 2>nul

REM Wait for processes to terminate
timeout /t 3 /nobreak > nul

REM Kill processes on ports 11434, 11435, 8080, and 8000
echo Killing processes on ports 11434, 11435, 8080, 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :11434 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :11435 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
timeout /t 3 /nobreak > nul

REM Wait a bit more
timeout /t 2 /nobreak > nul

echo.
echo Starting Ollama on port 11435...
REM Note: If your models are in a custom location, set OLLAMA_MODELS environment variable
REM Example: setx OLLAMA_MODELS "D:\ollama\models" (run once in cmd, then restart)
if defined OLLAMA_MODELS (
    echo Using custom model path: %OLLAMA_MODELS%
    start "Ollama Server" cmd /k "set OLLAMA_HOST=127.0.0.1:11435 && set OLLAMA_MODELS=%OLLAMA_MODELS% && ollama serve"
) else (
    echo Using default Ollama model path
    start "Ollama Server" cmd /k "set OLLAMA_HOST=127.0.0.1:11435 && ollama serve"
)

REM Wait for Ollama to start
timeout /t 3 /nobreak > nul

echo Starting Proxy + WebSocket bridge (ports 11434 and 8080)...
start "Ollama Proxy + WebSocket Bridge" cmd /k python websocket_bridge.py

echo Starting HTTP server (port 8000)...
start "HTTP Server" cmd /k python -m http.server 8000

REM Wait for servers to initialize
timeout /t 3 /nobreak > nul

REM Generate random cache buster
set /a timestamp=%RANDOM%%RANDOM%

REM Open Matrix Rain
echo.
echo Opening Matrix Rain interface...
start http://localhost:8000/matrix-rain-utility-suite.html?v=%timestamp%

REM Wait a bit
timeout /t 2 /nobreak > nul

REM Open Test Interface
echo Opening Test interface...
start http://localhost:8000/test-interface.html?v=%timestamp%

echo.
echo ========================================
echo   ✅ SYSTEM RUNNING
echo ========================================
echo.
echo 🤖 Ollama Server: http://localhost:11435 (real)
echo 🔄 HTTP Proxy: http://localhost:11434 (intercepts native chat)
echo 🌀 WebSocket Bridge: ws://localhost:8080
echo 🌊 Matrix Rain: http://localhost:8000/matrix-rain-utility-suite.html
echo 🧪 Test Interface: http://localhost:8000/test-interface.html
echo.
echo INSTRUCTIONS:
echo 1. In Matrix Rain, click "OLLAMA MODE" button
echo 2. Use Ollama native chat app (connects to proxy on 11434)
echo 3. Watch AI responses flow through the matrix rain!
echo.
echo CLOSE OLD TABS! Use the new tabs that just opened.
echo Close this window or press Ctrl+C to stop ALL servers.
echo.
pause

REM Cleanup on exit
echo.
echo Stopping all servers...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM ollama.exe 2>nul
taskkill /F /IM ollama_llama_server.exe 2>nul

