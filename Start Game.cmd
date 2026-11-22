@echo off
setlocal
cd /d "%~dp0"
set "BOLLY_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "BOLLY_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not "%BOLLY_NODE%"=="node" if not exist "%BOLLY_NODE%" (
 echo Install Node.js 22 or newer, then open this file again.
 pause
 exit /b 1
)
start "" "http://localhost:4173/"
"%BOLLY_NODE%" server.mjs
pause
