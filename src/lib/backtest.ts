// Deterministic backtest engine.
//
// This is a SIMULATED engine: there is no live historical-data feed, so it
// generates a reproducible pseudo-random-walk market seeded by the strategy
// id, executes a simple rule-based trade loop over it, and computes real
// statistics (net P&L, win rate, profit factor, max drawdown, trade count)
// plus an equity curve for charts. Same strategy id => same results, every
// run. Results are illustrative, not trading advice.

import type { BacktestStats } from './types';

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
 */
export function runBacktestEngine(
  strategyId: string,
  startingEquity = 10000,
  bars = 252,
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

  // Rule-based trade loop: momentum crossover with ATR-ish sizing.
  const lookback = 5 + Math.floor(rand() * 15);
  const riskPct = 0.01 + rand() * 0.02;
  let equity = startingEquity;
  const equityCurve: number[] = [startingEquity];
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let peak = startingEquity;
  let maxDrawdown = 0;
  let trades = 0;

  for (let i = lookback + 1; i < closes.length; i++) {
    const sma = closes.slice(i - lookback, i).reduce((a, b) => a + b, 0) / lookback;
    const prevSma =
      closes.slice(i - lookback - 1, i - 1).reduce((a, b) => a + b, 0) / lookback;
    const longSignal = closes[i] > sma && closes[i - 1] <= prevSma;
    const shortSignal = closes[i] < sma && closes[i - 1] >= prevSma;
    if (!longSignal && !shortSignal) continue;

    const direction = longSignal ? 1 : -1;
    // Hold N bars then exit
    const hold = 3 + Math.floor(rand() * 12);
    const exitIdx = Math.min(i + hold, closes.length - 1);
    const ret = direction * (closes[exitIdx] - closes[i]) / closes[i];
    const risk = equity * riskPct;
    const pnl = ret === 0 ? 0 : (ret / (vol * 2)) * risk * Math.sign(ret || 1);

    equity += pnl;
    trades++;
    if (pnl >= 0) {
      wins++;
      grossProfit += pnl;
    } else {
      losses++;
      grossLoss += -pnl;
    }
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : (peak - equity) / peak);
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
  return {
    netProfit: Math.round(netProfit * 100) / 100,
    winRate: trades === 0 ? 0 : Math.round((wins / trades) * 10000) / 100,
    profitFactor:
      grossLoss === 0 ? (grossProfit > 0 ? 99.99 : 0) : Math.round((grossProfit / grossLoss) * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
    trades,
    equity: curve,
  };
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
