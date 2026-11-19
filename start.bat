@echo off
title Hardware Shop - Credit Customer Records (Khata)
echo ========================================================
echo   HARDWARE SHOP - CREDIT CUSTOMER RECORDS (KHATA)
echo ========================================================
echo.
echo Starting server at http://localhost:3001 ...
echo.
cd /d "%~dp0"
start "" http://localhost:3001
node server.js
if %errorlevel% neq 0 (
  echo.
  echo Server stopped or encountered an error.
  pause
)
