param([string]$Root)

# app.config.js is JS, not JSON (it computes android.versionCode from
# LOCAL_FALLBACK_VERSION_CODE / ANDROID_VERSION_CODE), so require() it
# through node rather than parsing it as text.
$configPath = Join-Path $Root "mobile\app.config.js"
$json = node -e "console.log(JSON.stringify(require(process.argv[1]).expo))" $configPath
$expo = $json | ConvertFrom-Json
Write-Host "$($expo.version) $($expo.android.versionCode)"
