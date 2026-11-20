// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require('../plugins/withOptionalPortrait');

const { setPortraitOptional } = plugin;
const NAME = 'android.hardware.screen.portrait';

type Feature = { $: Record<string, string> };
const portrait = (m: { 'uses-feature'?: Feature[] }) =>
  (m['uses-feature'] ?? []).filter((f) => f.$['android:name'] === NAME);

describe('withOptionalPortrait (TASK-031)', () => {
  it('adds an optional portrait feature when none exists', () => {
    const m: { 'uses-feature'?: Feature[] } = {};
    setPortraitOptional(m);
    expect(portrait(m)).toEqual([{ $: { 'android:name': NAME, 'android:required': 'false' } }]);
  });

  it('overrides required="true" without duplicating', () => {
    const m = { 'uses-feature': [{ $: { 'android:name': NAME, 'android:required': 'true' } }] };
    setPortraitOptional(m);
    expect(portrait(m)).toHaveLength(1);
    expect(portrait(m)[0].$['android:required']).toBe('false');
  });

  it('keeps other features', () => {
    const other = { $: { 'android:name': 'android.hardware.camera', 'android:required': 'true' } };
    const m = { 'uses-feature': [other] };
    setPortraitOptional(m);
    expect(m['uses-feature']).toContain(other);
    expect(m['uses-feature']).toHaveLength(2);
  });

  it('is idempotent', () => {
    const m: { 'uses-feature'?: Feature[] } = {};
    setPortraitOptional(m);
    setPortraitOptional(m);
    expect(m['uses-feature']).toHaveLength(1);
  });

  it('is registered in app.config.js and the app stays portrait', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../app.config.js');
    expect(config.expo.plugins).toContain('./plugins/withOptionalPortrait');
    expect(config.expo.orientation).toBe('portrait');
  });
});
