/** TASK-049: test-app.mjs runs only the language-neutral suite and rejects unknown apps. */
import { spawnSync } from 'child_process';
import { join } from 'path';

const script = join(__dirname, '..', 'scripts', 'test-app.mjs');
const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

it('prints a command that targets only __tests__/activeApp', () => {
  const r = run('es', '--print-command');
  expect(r.status).toBe(0);
  const line = r.stdout.trim();
  expect(line).toContain('__tests__/activeApp');
  expect(line.split(' ').filter((a) => a.startsWith('__tests__'))).toEqual(['__tests__/activeApp']);
});

it('an unknown app is a usage error (exit 2) and runs nothing', () => {
  const r = run('zz', '--print-command');
  expect(r.status).toBe(2);
  expect(r.stderr).toContain('Usage');
});

it('no argument is a usage error', () => {
  expect(run().status).toBe(2);
});
