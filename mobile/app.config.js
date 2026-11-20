// Bump this before every local (non-CI) release build/upload to Play — see
// the comment on android.versionCode below for why this exists.
const LOCAL_FALLBACK_VERSION_CODE = 20;

// Version string is always MAJOR.MINOR.VERSION_CODE so it can never drift from
// the Android versionCode. Edit MAJOR / MINOR by hand for releases.
const VERSION_MAJOR = 1;
const VERSION_MINOR = 0;
const VERSION_CODE = process.env.ANDROID_VERSION_CODE
  ? parseInt(process.env.ANDROID_VERSION_CODE, 10)
  : LOCAL_FALLBACK_VERSION_CODE;
const VERSION_NAME = `${VERSION_MAJOR}.${VERSION_MINOR}.${VERSION_CODE}`;

module.exports = {
  expo: {
    name: 'GermanBuddy',
    slug: 'germanbuddy',
    version: VERSION_NAME,
    orientation: 'portrait',
    scheme: 'germanbuddy',
    icon: './assets/icon.png',
    platforms: ['ios', 'android'],
    android: {
      package: 'com.giamat90.germanbuddy',
      // Play Store requires a strictly increasing versionCode on every upload.
      // CI sets ANDROID_VERSION_CODE (see .github/workflows/release-android.yml);
      // local manual builds fall back to the hardcoded value below.
      //
      // versionCode 1 has already been uploaded to Play (manual local build,
      // before ANDROID_VERSION_CODE existed) — bump LOCAL_FALLBACK_VERSION_CODE
      // by hand before every local (non-CI) release build/upload.
      versionCode: VERSION_CODE,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f2d44',
      },
      permissions: [
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
      ],
    },
    ios: {
      bundleIdentifier: 'com.germanbuddy',
    },
    plugins: [
      'expo-router',
      'expo-notifications',
      [
        'expo-build-properties',
        {
          android: {
            // Play's automatic protection requires minSdkVersion 24 or higher.
            minSdkVersion: 24,
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: '36.0.0',
          },
        },
      ],
      './plugins/withReleaseSigning',
      './plugins/withAndroidBackupRules',
      './plugins/withRtlSupport',
      './plugins/withOptionalPortrait',
    ],
    extra: {
      router: { origin: false },
      eas: { projectId: '8eb48752-1c1a-4169-a031-9e916c8b33da' },
    },
    owner: 'giamat',
  },
};
