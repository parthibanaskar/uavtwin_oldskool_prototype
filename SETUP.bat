@echo off
REM ================================================================
REM UAV Digital Twin - Complete Environment Setup
REM Run this as Administrator
REM ================================================================

echo ============================================================
echo Step 1: Installing Python 3.11 via winget (Microsoft Store)
echo ============================================================
winget install --id Python.Python.3.11 -e --source winget --accept-package-agreements --accept-source-agreements

echo.
echo ============================================================
echo Step 2: Installing Node.js (for GCS Server)
echo ============================================================
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements

echo.
echo ============================================================
echo Step 3: Refreshing PATH
echo ============================================================
call refreshenv 2>nul || echo Restart terminal after this script finishes.

echo.
echo ============================================================
echo Step 4: Installing Python packages (PyTorch + all AI tools)
echo ============================================================
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install numpy pandas websockets scikit-image opencv-python ultralytics matplotlib

echo.
echo ============================================================
echo Step 5: Installing GCS Server (Node.js dependencies)
echo ============================================================
cd /d e:\uavtwin\gcs-server
npm install

echo.
echo ============================================================
echo Step 6: Generating synthetic RTF dataset
echo ============================================================
cd /d e:\uavtwin\edge-server\python\data
python generate_rtf_dataset.py

echo.
echo ============================================================
echo Step 7: Training the Physics PINN (RUL Model)
echo ============================================================
cd /d e:\uavtwin\edge-server\python
python train_physics_pinn.py --csv data\synthetic_male_uav_engine_RTF.csv --epochs 40 --out physics_pinn.pt

echo.
echo ============================================================
echo ALL DONE! To start the system:
echo   Terminal 1: cd e:\uavtwin\gcs-server  ^&  node server.js
echo   Terminal 2: cd e:\uavtwin\edge-server\python  ^&  python main.py
echo   Terminal 3: cd e:\uavtwin  ^&  npm run dev
echo ============================================================
pause
