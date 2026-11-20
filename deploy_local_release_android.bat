@echo off
cd /d "%~dp0mobile" || exit /b 1
npx expo run:android --variant release --no-bundler
