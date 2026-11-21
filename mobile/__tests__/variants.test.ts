/** TASK-047: one codebase, one app per language. */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, copyFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { de } from '../src/languages/de';
import { es } from '../src/languages/es';
/* eslint-disable @typescript-eslint/no-var-requires */
const v = require('../scripts/lib/variants.js');

const root = join(__dirname, '..');
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const names = (plugins: unknown[]) => plugins.map((p) => (Array.isArray(p) ? p[0] : p));
const plugin = (plugins: unknown[], name: string) => plugins.find((p) => (Array.isArray(p) ? p[0] : p) === name);

/** A temp variants folder holding one variant (and an icon so file checks pass). */
function tempVariants(over: Record<string, unknown> = {}, file = 'xx') {
  const base = mkdtempSync(join(tmpdir(), 'variants-'));
  dirs.push(base);
  mkdirSync(join(base, 'variants'));
  mkdirSync(join(base, 'assets'));
  copyFileSync(join(root, 'assets', 'icon.png'), join(base, 'assets', 'icon.png'));
  const data = { ...v.loadVariant('de'), code: 'xx', name: 'XBuddy', slug: 'xbuddy', scheme: 'xbuddy',
    androidPackage: 'com.example.xbuddy', iosBundleId: 'com.xbuddy', icon: './assets/icon.png',
    adaptiveIcon: { foreground: './assets/icon.png', background: '#112233' }, ...over };
  writeFileSync(join(base, 'variants', `${file}.json`), JSON.stringify(data));
  return { base, dir: join(base, 'variants'), data };
}

describe('the German app is unchanged', () => {
  const x = v.buildExpoConfig(v.loadVariant('de'), {});
  it('keeps every identifier', () => {
    expect(x.name).toBe('GermanBuddy');
    expect(x.slug).toBe('germanbuddy');
    expect(x.scheme).toBe('germanbuddy');
    expect(x.android.package).toBe('com.giamat90.germanbuddy');
    expect(x.ios.bundleIdentifier).toBe('com.germanbuddy');
    expect(x.owner).toBe('giamat');
    expect(x.extra.eas.projectId).toBe('8eb48752-1c1a-4169-a031-9e916c8b33da');
    expect(x.extra.router).toEqual({ origin: false });
    expect(x.version).toBe('1.0.20');
    expect(x.android.versionCode).toBe(20);
    expect(x.android.adaptiveIcon.backgroundColor).toBe('#0f2d44');
    expect(x.icon).toBe('./assets/icon.png');
    expect(x.android.adaptiveIcon.foregroundImage).toBe('./assets/adaptive-icon.png');
    expect(x.orientation).toBe('portrait');
  });
  it('keeps SDK levels and the plugin list', () => {
    const [, props] = plugin(x.plugins, 'expo-build-properties') as [string, { android: Record<string, number> }];
    expect(props.android.minSdkVersion).toBe(24);
    expect(props.android.targetSdkVersion).toBe(36);
    expect(names(x.plugins)).toEqual([
      'expo-router', 'expo-notifications', 'expo-build-properties',
      './plugins/withReleaseSigning', './plugins/withAndroidBackupRules', './plugins/withRtlSupport',
      './plugins/withOptionalPortrait',
    ]);
    expect(plugin(x.plugins, './plugins/withAndroidBackupRules')).toEqual(['./plugins/withAndroidBackupRules', { slug: 'germanbuddy' }]);
  });
  it('ANDROID_VERSION_CODE overrides the fallback for every app', () => {
    for (const code of ['de', 'es']) {
      const c = v.buildExpoConfig(v.loadVariant(code), { ANDROID_VERSION_CODE: '57' });
      expect(c.android.versionCode).toBe(57);
      expect(c.version).toBe('1.0.57');
    }
  });
});

describe('the Spanish app', () => {
  const x = v.buildExpoConfig(v.loadVariant('es'), {});
  const g = v.buildExpoConfig(v.loadVariant('de'), {});
  it('has its own identity', () => {
    expect(x.name).toBe('SpanishBuddy');
    expect(x.slug).toBe('spanishbuddy');
    expect(x.scheme).toBe('spanishbuddy');
    expect(x.android.package).toBe('com.giamat90.spanishbuddy');
    expect(x.ios.bundleIdentifier).toBe('com.spanishbuddy');
    expect(x.version).toBe('1.0.1');
    expect(x.android.versionCode).toBe(1);
    expect(x.android.adaptiveIcon.backgroundColor).toBe('#8a1c1c');
  });
  it('has no owner and no EAS block, but keeps the router extra', () => {
    expect(x.owner).toBeUndefined();
    expect(x.extra.eas).toBeUndefined();
    expect(x.extra.router).toEqual({ origin: false });
  });
  it('shares the SDK levels and plugins of German, with its own backup slug', () => {
    expect(names(x.plugins)).toEqual(names(g.plugins));
    expect(plugin(x.plugins, 'expo-build-properties')).toEqual(plugin(g.plugins, 'expo-build-properties'));
    expect(plugin(x.plugins, './plugins/withAndroidBackupRules')).toEqual(['./plugins/withAndroidBackupRules', { slug: 'spanishbuddy' }]);
  });
});

describe('variant files', () => {
  const codes: string[] = v.listVariants();
  const packs: Record<string, typeof de> = { de, es };
  it('lists de and es', () => expect(codes).toEqual(['de', 'es']));
  it('all validate', () => {
    for (const c of codes) expect(v.validateVariant(v.loadVariant(c), { root })).toEqual([]);
  });
  it('are unique by package, slug and scheme', () => {
    const all = codes.map((c) => v.loadVariant(c));
    for (const k of ['androidPackage', 'slug', 'scheme', 'iosBundleId']) {
      expect(new Set(all.map((a: Record<string, string>) => a[k])).size).toBe(all.length);
    }
  });
  it('agree with their language pack', () => {
    for (const c of codes) {
      const variant = v.loadVariant(c);
      expect(variant.code).toBe(packs[c].code);
      expect(variant.name).toBe(packs[c].app.name);
      expect(packs[c].app.backupTag.toLowerCase()).toBe(variant.slug);
    }
  });
  it('really point at icon files', () => {
    for (const c of codes) {
      const a = v.loadVariant(c);
      expect(existsSync(join(root, a.icon))).toBe(true);
      expect(existsSync(join(root, a.adaptiveIcon.foreground))).toBe(true);
    }
  });
  it.each([
    ['a bad package', { androidPackage: 'Com.Foo' }],
    ['a missing icon', { icon: './assets/nope.png' }],
    ['a bad colour', { adaptiveIcon: { foreground: './assets/icon.png', background: 'red' } }],
    ['a zero versionCode', { localFallbackVersionCode: 0 }],
    ['an owner without an EAS project', { owner: 'someone', easProjectId: undefined }],
    ['a code that differs from the file name', { code: 'yy' }],
  ])('rejects %s', (_label, over) => {
    const t = tempVariants(over as Record<string, unknown>);
    expect(v.validateVariant(JSON.parse(JSON.stringify({ ...t.data })), { root: t.base, fileCode: 'xx' }).length).toBeGreaterThan(0);
    expect(() => v.loadVariant('xx', { dir: t.dir, root: t.base })).toThrow();
  });
  it('accepts a well-formed temp variant', () => {
    const t = tempVariants({ easProjectId: undefined, owner: undefined });
    expect(v.loadVariant('xx', { dir: t.dir, root: t.base }).name).toBe('XBuddy');
  });
  it('an unknown app lists the known ones', () => {
    expect(() => v.loadVariant('xx')).toThrow(/de/);
    expect(() => v.loadVariant('xx')).toThrow(/es/);
  });
});

describe('which app builds', () => {
  function seams(code: string) {
    const src = mkdtempSync(join(tmpdir(), 'seam-'));
    dirs.push(src);
    mkdirSync(join(src, 'languages'));
    writeFileSync(join(src, 'languages', 'active.ts'), `// GENERATED\nexport { ${code} as activePack } from './${code}';\n`);
    return src;
  }
  it('APP_LANG wins; otherwise the seam language', () => {
    expect(v.resolveAppLang({ APP_LANG: 'es' }, { srcDir: seams('de') })).toBe('es');
    expect(v.resolveAppLang({}, { srcDir: seams('es') })).toBe('es');
    expect(v.resolveAppLang({}, { srcDir: seams('de') })).toBe('de');
  });
  it('an unknown APP_LANG throws', () => {
    expect(() => v.resolveAppLang({ APP_LANG: 'zz' }, { srcDir: seams('de') })).toThrow(/zz/);
  });
  it('a seam that disagrees throws with the fix in the message', () => {
    expect(() => v.assertSeamMatches('es', { srcDir: seams('de') })).toThrow(/set:language/);
    expect(() => v.assertSeamMatches('es', { srcDir: seams('de') })).toThrow(/with-language/);
    expect(() => v.assertSeamMatches('es', { srcDir: seams('es') })).not.toThrow();
  });
  describe('the real app.config.js', () => {
    const load = (env: Record<string, string>) => {
      const saved = { ...process.env };
      delete process.env.APP_LANG;
      delete process.env.APP_LANG_CHECK_SEAM;
      Object.assign(process.env, env);
      try {
        let out: any;
        jest.isolateModules(() => { out = require('../app.config.js'); });
        return out.expo;
      } finally {
        process.env = saved;
      }
    };
    it('is German with no env, and with APP_LANG=de', () => {
      expect(load({}).name).toBe('GermanBuddy');
      expect(load({ APP_LANG: 'de' }).android.package).toBe('com.giamat90.germanbuddy');
    });
    it('refuses Spanish while the seams are German', () => {
      expect(() => load({ APP_LANG: 'es' })).toThrow(/with-language/);
    });
    it('gives Spanish when the seam check is off (version reading)', () => {
      expect(load({ APP_LANG: 'es', APP_LANG_CHECK_SEAM: '0' }).android.package).toBe('com.giamat90.spanishbuddy');
    });
  });
});
