@echo off
setlocal
set "ROOT=%~dp0"
set "NODE=C:\Users\ricw5\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%ROOT%outputs\build.log" del /f /q "%ROOT%outputs\build.log"
"%NODE%" "%ROOT%node_modules\next\dist\bin\next" build > "%ROOT%outputs\build.log" 2>&1
exit /b %errorlevel%
