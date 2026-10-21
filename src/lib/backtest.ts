// Deterministic backtest engine.
//
// This is a SIMULATED engine: there is no live historical-data feed, so it
// generates a reproducible pseudo-random-walk market seeded by the strategy
// id, executes a simple rule-based trade loop over it, and computes real
// statistics (net P&L, win rate, profit factor, max drawdown, trade count)
// plus an equity curve for charts. Same strategy id + rule => same results,
// every run. Results are illustrative, not trading advice.
//
// The default 'momentum' rule keeps its exact historic PRNG draw sequence,
// so existing strategy stats never change when new rules are added.

import type { BacktestStats, BacktestTrade } from './types';
import { BACKTEST_RULES } from './types';

// mulberry32 — small deterministic PRNG
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Run the deterministic simulated backtest for a strategy.
 * @param strategyId stable id used as the random seed
 * @param startingEquity starting account value in USD
 * @param bars number of simulated market bars
 * @param rule signal rule — 'momentum' is the default (historic behavior);
 *   'meanreversion' and 'breakout' are alternative entry rules on the same
 *   seeded market so rules are comparable per strategy
 */
export function runBacktestEngine(
  strategyId: string,
  startingEquity = 10000,
  bars = 252,
  rule: (typeof BACKTEST_RULES)[number] = 'momentum',
): BacktestStats {
  const rand = mulberry32(seedFromString(strategyId || 'default'));
  const drift = (rand() - 0.42) * 0.004; // strategy "edge" baked into seed
  const vol = 0.012 + rand() * 0.02;

  // Generate a synthetic price walk
  const closes: number[] = [];
  let price = 100;
  for (let i = 0; i < bars; i++) {
    price *= 1 + drift + (rand() - 0.5) * 2 * vol;
    closes.push(price);
  }

  // Rule-based trade loop.
  // NOTE: the momentum path must not consume any extra PRNG draws beyond
  // what it historically did, so legacy stats stay identical.
  const lookback = 5 + Math.floor(rand() * 15);
  const riskPct = 0.01 + rand() * 0.02;

  // Extra parameters are drawn only for non-default rules, after the
  // historic draws, so the momentum sequence is untouched.
  const reversionBand = rule === 'meanreversion' ? 0.4 + rand() * 0.6 : 0;
  const breakoutLookback = rule === 'breakout' ? 5 + Math.floor(rand() * 10) : 0;

  let equity = startingEquity;
  const equityCurve: number[] = [startingEquity];
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let peak = startingEquity;
  let maxDrawdown = 0;
  let maxDrawdownUsd = 0;
  let trades = 0;
  let consecLosses = 0;
  let maxConsecLosses = 0;
  const tradeReturns: number[] = [];
  const tradeLog: BacktestTrade[] = [];

  for (let i = lookback + 1; i < closes.length; i++) {
    const sma = closes.slice(i - lookback, i).reduce((a, b) => a + b, 0) / lookback;
    const prevSma =
      closes.slice(i - lookback - 1, i - 1).reduce((a, b) => a + b, 0) / lookback;

    let longSignal = false;
    let shortSignal = false;
    if (rule === 'momentum') {
      longSignal = closes[i] > sma && closes[i - 1] <= prevSma;
      shortSignal = closes[i] < sma && closes[i - 1] >= prevSma;
    } else if (rule === 'meanreversion') {
      const band = sma * vol * reversionBand;
      longSignal = closes[i] < sma - band;
      shortSignal = closes[i] > sma + band;
    } else if (rule === 'breakout') {
      const window = closes.slice(Math.max(0, i - breakoutLookback), i);
      const hi = Math.max(...window);
      const lo = Math.min(...window);
      longSignal = closes[i] > hi;
      shortSignal = closes[i] < lo;
    }
    if (!longSignal && !shortSignal) continue;

    const direction = longSignal ? 1 : -1;
    // Hold N bars then exit
    const hold = 3 + Math.floor(rand() * 12);
    const exitIdx = Math.min(i + hold, closes.length - 1);
    const ret = direction * (closes[exitIdx] - closes[i]) / closes[i];
    const risk = equity * riskPct;
    const pnl = ret === 0 ? 0 : (ret / (vol * 2)) * risk * Math.sign(ret || 1);
    const retOnEquity = equity === 0 ? 0 : pnl / equity;

    equity += pnl;
    trades++;
    if (pnl >= 0) {
      wins++;
      grossProfit += pnl;
      consecLosses = 0;
    } else {
      losses++;
      grossLoss += -pnl;
      consecLosses++;
      maxConsecLosses = Math.max(maxConsecLosses, consecLosses);
    }
    tradeReturns.push(retOnEquity);
    tradeLog.push({
      direction,
      entryBar: i,
      exitBar: exitIdx,
      pnl: Math.round(pnl * 100) / 100,
      equityAfter: Math.round(equity * 100) / 100,
      rule,
    });
    peak = Math.max(peak, equity);
    const dd = peak === 0 ? 0 : (peak - equity) / peak;
    maxDrawdown = Math.max(maxDrawdown, dd);
    maxDrawdownUsd = Math.max(maxDrawdownUsd, peak - equity);
    equityCurve.push(equity);
    i = exitIdx; // skip ahead past the closed trade
  }

  // Downsample curve to <= 120 points for charting
  const curve: number[] = [];
  const step = Math.max(1, Math.floor(equityCurve.length / 120));
  for (let i = 0; i < equityCurve.length; i += step) curve.push(equityCurve[i]);
  if (curve[curve.length - 1] !== equityCurve[equityCurve.length - 1]) {
    curve.push(equityCurve[equityCurve.length - 1]);
  }

  const netProfit = equity - startingEquity;
  const avgWin = wins === 0 ? 0 : grossProfit / wins;
  const avgLoss = losses === 0 ? 0 : grossLoss / losses;
  const meanR = tradeReturns.length === 0 ? 0 : tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length;
  const sdR =
    tradeReturns.length < 2
      ? 0
      : Math.sqrt(
          tradeReturns.reduce((a, b) => a + (b - meanR) * (b - meanR), 0) / (tradeReturns.length - 1),
        );
  const sharpe = sdR === 0 ? 0 : (Math.sqrt(tradeReturns.length) * meanR) / sdR;
  const recoveryFactor = maxDrawdownUsd === 0 ? 0 : netProfit / maxDrawdownUsd;

  return {
    netProfit: Math.round(netProfit * 100) / 100,
    winRate: trades === 0 ? 0 : Math.round((wins / trades) * 10000) / 100,
    profitFactor:
      grossLoss === 0 ? (grossProfit > 0 ? 99.99 : 0) : Math.round((grossProfit / grossLoss) * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
    trades,
    equity: curve,
    rule,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    expectancy: trades === 0 ? 0 : Math.round((netProfit / trades) * 100) / 100,
    sharpe: Math.round(sharpe * 100) / 100,
    maxConsecLosses,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    recoveryFactor: Math.round(recoveryFactor * 100) / 100,
    maxDrawdownUsd: Math.round(maxDrawdownUsd * 100) / 100,
    tradeLog,
  };
}

/**
 * Run every rule on the same seeded market so strategies (and rules) can be
 * compared apples-to-apples in the compare view.
 */
export function runAllRules(
  strategyId: string,
  startingEquity = 10000,
  bars = 252,
): BacktestStats[] {
  return BACKTEST_RULES.map((rule) => runBacktestEngine(strategyId, startingEquity, bars, rule));
}

/** Build an SVG path string for an equity curve. Pure function. */
export function equitySparkPath(
  equity: number[],
  width: number,
  height: number,
  pad = 4,
): string {
  if (equity.length === 0) return '';
  const min = Math.min(...equity);
  const max = Math.max(...equity);
  const span = max - min || 1;
  const w = width - pad * 2;
  const h = height - pad * 2;
  return equity
    .map((v, i) => {
      const x = pad + (i / Math.max(1, equity.length - 1)) * w;
      const y = pad + (1 - (v - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function formatUsd(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPct(n: number): string {
  return `${n.toFixed(2)}%`;
}
