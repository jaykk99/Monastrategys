// Test runner for Monastrategys. Each tests/*.test.ts exports run().
// Run: npx tsx tests/run.ts
import { run as backtest } from './backtest.test';
import { run as validation } from './validation.test';
import { run as exportCsv } from './export.test';

const suites: Array<[string, () => void]> = [
  ['backtest', backtest],
  ['validation', validation],
  ['export', exportCsv],
];

let failed = 0;
for (const [name, fn] of suites) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL - ${name}`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
  }
}
if (failed > 0) {
  console.error(`${failed} suite(s) failed`);
  process.exit(1);
}
console.log('All suites passed');
