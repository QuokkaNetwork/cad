@echo off
cd /d "C:\Users\levis\Documents\Development files\cad"
del /f /q test-output.txt 2>nul
"C:\Program Files\nodejs\node.exe" server\scripts\test-mumble-local.js >> test-output.txt 2>&1
echo Exit code: %ERRORLEVEL% >> test-output.txt
