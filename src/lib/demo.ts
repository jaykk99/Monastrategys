// Demo-mode data: used when no Firebase config is present.
// The app stays fully usable (browse strategies, run simulated backtests,
// local sign-in) with data persisted to localStorage. Nothing here is a
// substitute for a real backend — it is clearly labeled DEMO in the UI.

import type { Strategy, UserProfile } from './types';

const DEMO_STRATEGIES: Strategy[] = [
  {
    id: 'demo-momentum-breakout',
    title: 'Momentum Breakout Hunter',
    description:
      'Donchian-channel breakout with ATR-based stop and trailing exit. Best on trending crypto pairs.',
    assetCategory: 'CRYPTO',
    timeframes: ['15M', '1H', '4H'],
    isAutoTrade: false,
    content: `//@version=5
strategy("Momentum Breakout Hunter", overlay=true, initial_capital=10000)

length   = input.int(20, "Channel Length")
atrLen   = input.int(14, "ATR Length")
atrMult  = input.float(2.0, "ATR Multiplier")

upper = ta.highest(high, length)
lower = ta.lowest(low, length)
atr   = ta.atr(atrLen)

longSignal  = close > upper[1]
shortSignal = close < lower[1]

if longSignal
    strategy.entry("Long", strategy.long)
if shortSignal
    strategy.entry("Short", strategy.short)

strategy.exit("Trail", from_entry="Long", trail_points=atr * atrMult / syminfo.mintick)
strategy.exit("TrailS", from_entry="Short", trail_points=atr * atrMult / syminfo.mintick)

plot(upper, "Upper", color=color.new(color.teal, 0))
plot(lower, "Lower", color=color.new(color.red, 0))`,
  },
  {
    id: 'demo-rsi-reversion',
    title: 'RSI Mean Reversion',
    description:
      'Fades overbought/oversold RSI extremes on stocks and indices with time-of-day filter.',
    assetCategory: 'STOCKS',
    timeframes: ['5M', '15M', '1H'],
    isAutoTrade: false,
    content: `//@version=5
strategy("RSI Mean Reversion", overlay=false, initial_capital=10000)

rsiLen  = input.int(14, "RSI Length")
overB   = input.int(70, "Overbought")
overS   = input.int(30, "Oversold")

rsi = ta.rsi(close, rsiLen)
plot(rsi, "RSI", color=color.purple)
hline(overB, "OB", color=color.red)
hline(overS, "OS", color=color.green)

longCond  = ta.crossover(rsi, overS)
shortCond = ta.crossunder(rsi, overB)

if longCond
    strategy.entry("Long", strategy.long)
if shortCond
    strategy.entry("Short", strategy.short)

strategy.close("Long", when=ta.crossover(rsi, 50))
strategy.close("Short", when=ta.crossunder(rsi, 50))`,
  },
  {
    id: 'demo-gold-scalper',
    title: 'Gold Scalper XAU/USD',
    description:
      'High-frequency scalper for gold on low timeframes. Tight stops, fixed risk per trade.',
    assetCategory: 'COMMODITIES',
    timeframes: ['1M', '5M'],
    isAutoTrade: true,
    content: `//@version=5
strategy("Gold Scalper XAU/USD", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

fastLen = input.int(9, "Fast EMA")
slowLen = input.int(21, "Slow EMA")
stopPts = input.float(1.5, "Stop (ATR x)")

fast = ta.ema(close, fastLen)
slow = ta.ema(close, slowLen)
atr  = ta.atr(14)

longSig  = ta.crossover(fast, slow)
shortSig = ta.crossunder(fast, slow)

if longSig
    strategy.entry("L", strategy.long)
if shortSig
    strategy.entry("S", strategy.short)

strategy.exit("SL", loss=stopPts * atr / syminfo.mintick)
plot(fast, "Fast", color=color.yellow)
plot(slow, "Slow", color=color.blue)`,
  },
  {
    id: 'demo-fx-trend-rider',
    title: 'FX Trend Rider',
    description:
      'Supertrend + ADX filter for forex majors. Auto-trade ready webhook payloads.',
    assetCategory: 'FOREX',
    timeframes: ['1H', '4H', '1D'],
    isAutoTrade: true,
    content: `//@version=5
strategy("FX Trend Rider", overlay=true, initial_capital=10000)

atrPeriod = input.int(10, "ATR Period")
mult      = input.float(3.0, "Multiplier")
adxLen    = input.int(14, "ADX Length")
adxMin    = input.int(20, "Min ADX")

[supertrend, direction] = ta.supertrend(mult, atrPeriod)
adx = ta.dmi(adxLen, adxLen)[2]

longOK  = direction < 0 and adx > adxMin
shortOK = direction > 0 and adx > adxMin

if ta.change(direction) < 0 and longOK
    strategy.entry("Long", strategy.long)
if ta.change(direction) > 0 and shortOK
    strategy.entry("Short", strategy.short)

plot(supertrend, "Supertrend", color=direction < 0 ? color.green : color.red)

// Auto-trade webhook: {"action":"{{strategy.order.action}}","ticker":"{{ticker}}","price":{{close}}}`,
  },
  {
    id: 'demo-index-swing',
    title: 'Index Swing Composite',
    description:
      'Multi-indicator swing system for indices: MACD + Bollinger + volume confirmation.',
    assetCategory: 'INDICES',
    timeframes: ['4H', '1D', '1W'],
    isAutoTrade: false,
    content: `//@version=5
strategy("Index Swing Composite", overlay=true, initial_capital=10000)

[macdLine, signalLine, _] = ta.macd(close, 12, 26, 9)
[mid, upper, lower] = ta.bb(close, 20, 2.0)
volAvg = ta.sma(volume, 20)

longSig  = ta.crossover(macdLine, signalLine) and close < lower and volume > volAvg
shortSig = ta.crossunder(macdLine, signalLine) and close > upper and volume > volAvg

if longSig
    strategy.entry("Long", strategy.long)
if shortSig
    strategy.entry("Short", strategy.short)

strategy.exit("TP/SL", profit=close * 0.04 / syminfo.mintick, loss=close * 0.02 / syminfo.mintick)
plot(mid, "BB Mid", color=color.orange)`,
  },
  {
    id: 'demo-defi-yield-arb',
    title: 'DeFi Funding Arbitrage',
    description:
      'Monitors funding-rate spreads across perps venues. Manual execution framework with alerts.',
    assetCategory: 'FUNDS',
    timeframes: ['1H', '4H'],
    isAutoTrade: true,
    content: `//@version=5
strategy("DeFi Funding Arbitrage", overlay=false, initial_capital=10000)

spreadThresh = input.float(0.05, "Min Spread %", step=0.01)
fundA = input.source(close, "Venue A Funding (as series)")
fundB = input.source(close, "Venue B Funding (as series)")

spread = (fundA - fundB) * 100
plot(spread, "Funding Spread %", color=color.aqua)
hline(spreadThresh, "Threshold", color=color.red)
hline(-spreadThresh, "-Threshold", color=color.green)

alertcondition(spread > spreadThresh,  title="Arb Long B / Short A",  message="Funding arb: spread above threshold")
alertcondition(spread < -spreadThresh, title="Arb Long A / Short B", message="Funding arb: spread below -threshold")`,
  },
];

export function getDemoStrategies(): Strategy[] {
  return DEMO_STRATEGIES.map((s) => ({ ...s }));
}

const DEMO_USER_KEY = 'monastrategys_demo_user_v1';

export function loadDemoProfile(email: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed.email === email ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDemoProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(profile));
  } catch {
    /* storage full/blocked — profile just won't persist */
  }
}

export function clearDemoProfile(): void {
  try {
    localStorage.removeItem(DEMO_USER_KEY);
  } catch {
    /* ignore */
  }
}

export function createDemoProfile(email: string, role: 'admin' | 'user' = 'user'): UserProfile {
  return {
    uid: `demo-${email}`,
    email,
    role,
    plan: 'STARTER',
    unlockedStrats: [],
    backtestCount: 0,
    createdAt: new Date().toISOString(),
  };
}
