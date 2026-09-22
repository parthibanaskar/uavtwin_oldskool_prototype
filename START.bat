@echo off
REM ================================================================
REM UAV Digital Twin - Launch All Services
REM Run after SETUP.bat has completed successfully
REM ================================================================

echo Starting GCS API Gateway (Express)...
start "GCS Server" cmd /k "cd /d e:\uavtwin\gcs-server && node server.js"

timeout /t 2 /nobreak

echo Starting Edge AI Server (Python)...
start "Edge Server" cmd /k "cd /d e:\uavtwin\edge-server\python && python main.py"

timeout /t 2 /nobreak

echo Starting React Dashboard...
start "React Dashboard" cmd /k "cd /d e:\uavtwin && npm run dev"

timeout /t 3 /nobreak

echo Opening browser...
start "" "http://localhost:8080"

echo.
echo All 3 services started!
echo - GCS Gateway:   http://localhost:3001
echo - Edge Server:   ws://localhost:3001 (WebSocket)
echo - Dashboard:     http://localhost:8080
echo.
pause
