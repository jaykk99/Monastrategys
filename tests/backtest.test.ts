// Engine tests: determinism, invariants, rule variants, trade-log consistency.
// Run with: npx tsx tests/run.ts
import assert from 'node:assert/strict';
import { runBacktestEngine, runAllRules, equitySparkPath, formatUsd, formatPct } from '../src/lib/backtest';
import { BACKTEST_RULES } from '../src/lib/types';

export function run() {
  // Determinism: same id + rule => byte-identical results
  {
    const a = runBacktestEngine('strategy-abc');
    const b = runBacktestEngine('strategy-abc');
    assert.deepEqual(a, b, 'same strategy id must produce identical stats');
  }

  // Determinism across all rules
  for (const rule of BACKTEST_RULES) {
    const a = runBacktestEngine('strategy-abc', 10000, 252, rule);
    const b = runBacktestEngine('strategy-abc', 10000, 252, rule);
    assert.deepEqual(a, b, `rule ${rule} must be deterministic`);
  }

  // Different strategy ids seed different markets
  {
    const a = runBacktestEngine('id-one');
    const b = runBacktestEngine('id-two');
    assert.notDeepEqual(a.equity, b.equity, 'different ids should seed different markets');
  }

  // Rule variants must actually change results (signals differ)
  {
    const results = runAllRules('rule-diff-check');
    assert.equal(results.length, BACKTEST_RULES.length, 'runAllRules must cover every rule');
    const keys = results.map((r) => r.rule);
    assert.deepEqual(keys, [...BACKTEST_RULES], 'runAllRules order matches BACKTEST_RULES');
    const profits = new Set(results.map((r) => r.netProfit));
    assert.ok(profits.size > 1, 'rules should produce different net profits on the same market');
  }

  // Trade-log consistency: pnl sum == netProfit, trades count matches
  {
    for (const id of ['strategy-abc', 'strategy-xyz', 'default']) {
      for (const rule of BACKTEST_RULES) {
        const s = runBacktestEngine(id, 10000, 252, rule);
        const pnlSum = s.tradeLog.reduce((a, t) => a + t.pnl, 0);
        assert.equal(s.trades, s.tradeLog.length, `${id}/${rule}: trades count must match tradeLog length`);
        assert.ok(
          Math.abs(pnlSum - s.netProfit) < 1.01,
          `${id}/${rule}: trade pnl sum (${pnlSum}) must equal netProfit (${s.netProfit}) within rounding`,
        );
        for (const t of s.tradeLog) {
          assert.ok(t.entryBar <= t.exitBar, 'exit bar must be at or after entry bar');
          assert.ok(t.exitBar < 252, 'exit bar must be within bars');
          assert.equal(t.rule, rule, 'trade must record its rule');
          assert.ok(t.direction === 1 || t.direction === -1, 'direction must be +-1');
        }
        // win-rate sanity: wins+losses accounting
        const wins = s.tradeLog.filter((t) => t.pnl >= 0).length;
        assert.ok(
          Math.abs((wins / Math.max(1, s.trades)) * 100 - s.winRate) < 0.011,
          `${id}/${rule}: winRate must match trade log`,
        );
      }
    }
  }

  // Invariants
  {
    const s = runBacktestEngine('invariants-check');
    assert.ok(s.trades >= 0, 'trades >= 0');
    assert.ok(s.winRate >= 0 && s.winRate <= 100, 'winRate in [0,100]');
    assert.ok(s.maxDrawdown >= 0 && s.maxDrawdown <= 100, 'maxDrawdown in [0,100]');
    assert.ok(s.profitFactor >= 0, 'profitFactor >= 0');
    assert.ok(s.avgWin >= 0, 'avgWin >= 0');
    assert.ok(s.avgLoss >= 0, 'avgLoss >= 0');
    assert.ok(Number.isFinite(s.sharpe), 'sharpe finite');
    assert.ok(s.maxConsecLosses >= 0, 'maxConsecLosses >= 0');
    assert.ok(s.maxDrawdownUsd >= 0, 'maxDrawdownUsd >= 0');
    assert.ok(s.equity.length >= 1 && s.equity.length <= 121, 'equity curve downsampled to <= 120+1 points');
    assert.equal(s.equity[0], 10000, 'equity curve starts at startingEquity');
  }

  // Empty id falls back to the 'default' seed, no crash
  {
    const s = runBacktestEngine('');
    assert.deepEqual(s, runBacktestEngine('default'), 'empty id must behave like "default"');
  }

  // Tiny bar count: no crash, bounded curve
  {
    const s = runBacktestEngine('tiny', 5000, 20);
    assert.ok(s.equity.length <= 21, 'small bar count stays bounded');
    assert.equal(s.equity[0], 5000, 'starting equity respected');
  }

  // Chart + format helpers
  {
    const path = equitySparkPath([100, 110, 105, 120], 800, 240);
    assert.ok(path.startsWith('M'), 'spark path starts with M');
    assert.ok(path.includes('L'), 'spark path has line segments');
    assert.equal(equitySparkPath([], 800, 240), '', 'empty curve yields empty path');
    assert.equal(formatUsd(1234.5), '$1,234.50', 'formatUsd positive');
    assert.equal(formatUsd(-99.1), '-$99.10', 'formatUsd negative');
    assert.equal(formatPct(12.345), '12.35%', 'formatPct');
  }
}
