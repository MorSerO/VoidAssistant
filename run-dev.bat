@echo off
chcp 65001 >nul
echo ============================================
echo   Void AI Assistant - Development Mode
echo ============================================
echo.
echo Step 1: Building TypeScript...
call npx tsc -p tsconfig.main.json
if %errorlevel% neq 0 (
    echo [FAIL] TypeScript build failed
    pause
    exit /b 1
)
echo [OK] TypeScript compiled
echo.
echo Step 2: Starting Vite dev server...
start "Vite" cmd /c "npx vite --config vite.renderer.config.ts"
echo [OK] Vite starting on http://localhost:5173
echo.
echo Step 3: Launching Electron...
timeout /t 3 /nobreak >nul
npx electron .
pause
