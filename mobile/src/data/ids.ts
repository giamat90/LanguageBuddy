/**
 * Small, dependency-free unique id generator. Not a real UUID, but collision-safe
 * enough for a single-device local database.
 */
export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${rand}`;
}
