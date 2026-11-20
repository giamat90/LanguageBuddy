/** TASK-026: guards against an SDK upgrade silently dropping the Play-relevant config or local plugins. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../app.config.js');

describe('app.config.js', () => {
  const expo = config.expo ?? config.default?.expo ?? config;
  const plugins: unknown[] = expo.plugins;
  const named = (name: string) => plugins.find((p) => (Array.isArray(p) ? p[0] : p) === name);

  it('keeps minSdkVersion 24 and targetSdkVersion 36', () => {
    const [, props] = named('expo-build-properties') as [string, { android: Record<string, number> }];
    expect(props.android.minSdkVersion).toBe(24);
    expect(props.android.targetSdkVersion).toBe(36);
  });

  it('keeps the three local config plugins', () => {
    for (const p of ['./plugins/withReleaseSigning', './plugins/withAndroidBackupRules', './plugins/withRtlSupport']) {
      expect(named(p)).toBeDefined();
    }
  });

  it('has a versionCode above the 13 already on Play', () => {
    expect(expo.android.versionCode).toBeGreaterThanOrEqual(14);
  });
});
