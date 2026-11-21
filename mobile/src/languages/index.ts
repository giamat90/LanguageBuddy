import { de } from './de';
import type { LanguagePack } from './types';

export type { LanguagePack, TargetLanguageCode, Gender, ArticleSupport, GenderSupport, CaseSupport } from './types';

// One target language per app: the pack is fixed at build time (variants arrive with TASK-047).
let active: LanguagePack = de;

/** Called at use time, never at import time, so a test switch takes effect. */
export function getActivePack(): LanguagePack {
  return active;
}

/** Tests only. Always restore with `null` in afterEach. */
export function setActivePackForTests(pack: LanguagePack | null): void {
  active = pack ?? de;
}
