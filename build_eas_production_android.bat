@echo off
cd /d "%~dp0mobile" || exit /b 1
eas build --platform android --profile production
