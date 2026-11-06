import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const root = new URL('../', import.meta.url),
  tests = [];
for (const file of (await readdir(new URL('tests/', root))).sort()) {
  if (!file.endsWith('.test.mjs')) continue;
  tests.push('tests/' + file);
}
console.log(
  'Automatic regression: ' +
    tests.length +
    ' test files. All tests use local fixtures and isolated server data.',
);
const child = spawn(process.execPath, ['--test', '--test-concurrency=2', ...tests], {
  cwd: root,
  stdio: 'inherit',
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
