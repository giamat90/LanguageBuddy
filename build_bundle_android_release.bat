@echo off
setlocal

set APP_LANG=%~1
if "%APP_LANG%"=="" set APP_LANG=de
if /I "%~2"=="--inner" goto :inner
:: One language per build: run this same script again inside with-language, which activates the
:: language's generated seams for the whole prebuild + Gradle/Metro run and restores them afterwards.
cd /d "%~dp0mobile" || exit /b 1
call node scripts\with-language.mjs %APP_LANG% -- "%~f0" %APP_LANG% --inner
exit /b %errorlevel%

:inner

set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%

set MOBILE_DIR=%ROOT%\mobile
set ANDROID_DIR=%MOBILE_DIR%\android
set BUILD_GRADLE=%ANDROID_DIR%\app\build.gradle

:: Regenerate the native android project from app.config.js on every build so
:: build.gradle can never go stale. (This is what broke a Play upload: after
:: bumping LOCAL_FALLBACK_VERSION_CODE in app.config.js without re-running
:: prebuild, build.gradle still had the old versionCode baked in, so the AAB
:: shipped the old code under a filename claiming the new one.)
echo Running expo prebuild to sync the native project with app.config.js...
cd /d "%MOBILE_DIR%"
call npx expo prebuild --platform android --clean
if errorlevel 1 (
    echo expo prebuild failed!
    exit /b 1
)

if not exist "%BUILD_GRADLE%" (
    echo Could not find %BUILD_GRADLE% after prebuild.
    exit /b 1
)

:: Read version straight from mobile\app.config.js - it's the single source
:: of truth (see build_get_version.ps1), same pattern as GreenThumb's
:: build_get_version.ps1 / app.json.
for /f "usebackq tokens=1,2" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\build_get_version.ps1" -Root "%ROOT%"`) do (
    set VERSION_NAME=%%a
    set VERSION_CODE=%%b
)

if "%VERSION_CODE%"=="" (
    echo Could not read android.versionCode from mobile\app.config.js
    exit /b 1
)
if "%VERSION_NAME%"=="" (
    echo Could not read version from mobile\app.config.js
    exit /b 1
)

:: Belt-and-braces: confirm prebuild actually baked in the version we expect
:: before spending time on a gradle build.
for /f "tokens=2" %%v in ('findstr "versionCode" "%BUILD_GRADLE%"') do set BAKED_VERSION_CODE=%%v
if not "%BAKED_VERSION_CODE%"=="%VERSION_CODE%" (
    echo ERROR: build.gradle has versionCode %BAKED_VERSION_CODE% but app.config.js says %VERSION_CODE%.
    echo Aborting - the built AAB would not match the intended version.
    exit /b 1
)

echo Building bundle v%VERSION_NAME% (%VERSION_CODE%)...

cd /d "%ANDROID_DIR%"
call gradlew.bat bundleRelease
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

:: Create output folder and move artifact
if not exist "%ROOT%\Bundles" mkdir "%ROOT%\Bundles"

set SUFFIX=
if /I not "%APP_LANG%"=="de" set SUFFIX=-%APP_LANG%
set DEST=%ROOT%\Bundles\app-release%SUFFIX%-v%VERSION_NAME%-%VERSION_CODE%.aab
move /Y "%ANDROID_DIR%\app\build\outputs\bundle\release\app-release.aab" "%DEST%"

echo.
echo Bundle saved to: %DEST%
