// CSV export tests. Run with: npx tsx tests/run.ts
import assert from 'node:assert/strict';
import { tradesToCsv } from '../src/lib/export';
import { runBacktestEngine } from '../src/lib/backtest';

export function run() {
  // Hand-built trades
  {
    const csv = tradesToCsv([
      { direction: 1, entryBar: 10, exitBar: 15, pnl: 123.4, equityAfter: 10123.4, rule: 'momentum' },
      { direction: -1, entryBar: 20, exitBar: 22, pnl: -45.6, equityAfter: 10077.8, rule: 'momentum' },
    ]);
    const lines = csv.trim().split('\n');
    assert.equal(lines.length, 3, 'header + 2 rows');
    assert.equal(lines[0], 'trade,rule,direction,entry_bar,exit_bar,pnl_usd,equity_after_usd', 'header exact');
    assert.equal(lines[1], '1,momentum,LONG,10,15,123.40,10123.40', 'row 1 exact');
    assert.equal(lines[2], '2,momentum,SHORT,20,22,-45.60,10077.80', 'row 2 exact');
  }

  // Empty trade log still yields a header
  {
    const csv = tradesToCsv([]);
    assert.equal(csv, 'trade,rule,direction,entry_bar,exit_bar,pnl_usd,equity_after_usd\n', 'empty log header only');
  }

  // Real engine output round-trips through CSV losslessly (within rounding)
  {
    const s = runBacktestEngine('csv-roundtrip', 10000, 252, 'breakout');
    const csv = tradesToCsv(s.tradeLog);
    const rows = csv.trim().split('\n').slice(1);
    assert.equal(rows.length, s.trades, 'one row per trade');
    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i].split(',');
      assert.equal(Number(cols[0]), i + 1, 'trade number sequential');
      assert.equal(cols[1], s.tradeLog[i].rule, 'rule column matches');
      assert.equal(Number(cols[5]).toFixed(2), s.tradeLog[i].pnl.toFixed(2), 'pnl column matches');
    }
  }
}
