@echo off
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\serve.ps1" %*
echo.
echo Web service stopped. Press any key to close this window.
pause >nul
