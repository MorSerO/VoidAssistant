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
echo Step 2: Copying ESM entry and configs...
node -e "const fs=require('fs');fs.cpSync('src/main/esm-main.mjs','dist/main/esm-main.js');[{d:'dist/main/main'},{d:'dist/main/preload'},{d:'dist/main/shared'}].forEach(({d})=>{if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});fs.writeFileSync(d+'/package.json','{\"type\":\"commonjs\"}')})"
echo [OK] Build complete
echo.
echo Step 3: Starting Vite dev server...
start "Vite" cmd /c "npx vite --config vite.renderer.config.ts"
echo [OK] Vite starting on http://localhost:5173
echo.
echo Step 4: Launching Electron...
timeout /t 3 /nobreak >nul
npx electron .
pause
