import { MMKV } from 'react-native-mmkv';
import { uid } from './ids';

const storage = new MMKV({ id: 'app-meta' });
const KEY = 'installId';

/**
 * A stable per-install random id. Used only as the seed for the deterministic
 * daily-word shuffle so two installs don't see the words in the same order.
 */
export function getInstallId(): string {
  let value = storage.getString(KEY);
  if (!value) {
    value = uid('inst_');
    storage.set(KEY, value);
  }
  return value;
}
