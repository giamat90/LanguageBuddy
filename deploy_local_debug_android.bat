@echo off
set APP_LANG=%~1
if "%APP_LANG%"=="" set APP_LANG=de
if /I "%~2"=="--inner" goto :inner
:: One language per build: run this same script again inside with-language, which activates the
:: language's generated seams for the whole prebuild + Gradle/Metro run and restores them afterwards.
cd /d "%~dp0mobile" || exit /b 1
call node scripts\with-language.mjs %APP_LANG% -- "%~f0" %APP_LANG% --inner
exit /b %errorlevel%

:inner
cd /d "%~dp0mobile" || exit /b 1
:: android/ is generated per app (package name), so always rebuild it for the chosen language.
:: The debug run keeps Metro alive, so the language stays active until it exits.
call npx expo prebuild --platform android --clean || exit /b 1
npx expo run:android
