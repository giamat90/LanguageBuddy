/**
 * Expo config plugin: stops Gradle from bundling one language into another language's app (TASK-068).
 *
 * Why: prebuild generates the native project (package, name, icon) for one language, but Metro bundles
 * whatever src/languages/active.ts activates at the moment Gradle runs. A `gradlew bundleRelease` typed
 * by hand after `with-language` has restored the German seams produced a FrenchBuddy package with
 * German content, and it reached Google Play. The guard compares the two just before the JS bundle.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const BEGIN = '// withLanguageGuard (TASK-068): begin';
const END = '// withLanguageGuard (TASK-068): end';

const block = (code) => `${BEGIN}
tasks.configureEach { task ->
    if (task.name ==~ /createBundle.*JsAndAssets/) {
        task.doFirst {
            def seam = new File(rootDir.parentFile, "src/languages/active.ts").getText("UTF-8")
            if (!seam.contains("export { ${code} as activePack }")) {
                throw new GradleException("This android/ project was generated for the '${code}' app, but src/languages/active.ts " +
                    "activates another language. Run the whole build through: node scripts/with-language.mjs ${code} -- <command> " +
                    "(or build_bundle_android_release.bat ${code}).")
            }
        }
    }
}
${END}
`;

/** build.gradle with exactly one guard for \`code\` at the end. */
function addLanguageGuard(gradle, code) {
  if (!/^[a-z]{2}$/.test(code ?? '')) throw new Error(`withLanguageGuard: bad language code "${code}"`);
  const start = gradle.indexOf(BEGIN);
  let base = gradle;
  if (start >= 0) {
    const end = gradle.indexOf(END, start);
    base = gradle.slice(0, start) + (end >= 0 ? gradle.slice(end + END.length).replace(/^\r?\n/, '') : '');
  }
  return base + block(code);
}

function withLanguageGuard(config, { code } = {}) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addLanguageGuard(cfg.modResults.contents, code);
    return cfg;
  });
}

module.exports = withLanguageGuard;
module.exports.addLanguageGuard = addLanguageGuard;
