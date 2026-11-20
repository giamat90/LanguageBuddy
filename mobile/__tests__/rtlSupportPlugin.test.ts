// eslint-disable-next-line @typescript-eslint/no-var-requires
const rtlPlugin = require('../plugins/withRtlSupport');

const { setSupportsRtl } = rtlPlugin;

describe('withRtlSupport (TASK-024)', () => {
  it('declares android:supportsRtl="true" on <application>', () => {
    const app = { $: { 'android:name': '.MainApplication' } };
    expect(setSupportsRtl(app).$['android:supportsRtl']).toBe('true');
  });

  it('keeps the attributes that are already there', () => {
    const app = { $: { 'android:name': '.MainApplication', 'android:allowBackup': 'true' } };
    const out = setSupportsRtl(app).$;
    expect(out['android:name']).toBe('.MainApplication');
    expect(out['android:allowBackup']).toBe('true');
  });

  it('overrides an explicit false (Android would otherwise ignore forceRTL)', () => {
    const app = { $: { 'android:supportsRtl': 'false' } };
    expect(setSupportsRtl(app).$['android:supportsRtl']).toBe('true');
  });

  it('is idempotent', () => {
    const app = { $: {} as Record<string, string> };
    setSupportsRtl(app);
    setSupportsRtl(app);
    expect(Object.keys(app.$)).toEqual(['android:supportsRtl']);
  });

  it('is registered in app.config.js', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../app.config.js');
    expect(config.expo.plugins).toContain('./plugins/withRtlSupport');
  });
});
