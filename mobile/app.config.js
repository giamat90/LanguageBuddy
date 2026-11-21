// One codebase, one app per language (TASK-047): the app is chosen by APP_LANG (default: the language
// the generated seams activate) and described by variants/<code>.json. See scripts/lib/variants.js.
const { loadVariant, resolveAppLang, assertSeamMatches, buildExpoConfig } = require('./scripts/lib/variants');

const code = resolveAppLang(process.env);
// A Spanish package with German content must be impossible. (build_get_version.ps1 only reads
// version numbers and turns the check off.)
if (process.env.APP_LANG && process.env.APP_LANG_CHECK_SEAM !== '0') assertSeamMatches(code);

module.exports = { expo: buildExpoConfig(loadVariant(code), process.env) };
