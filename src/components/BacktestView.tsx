import { useMemo } from 'react';
import { equitySparkPath, formatUsd } from '../lib/backtest';
import type { BacktestRun, PlanName, Strategy } from '../lib/types';

interface Props {
  strategies: Strategy[];
  plan: PlanName;
  backtestCount: number;
  isAdmin: boolean;
  selectedStratId: string;
  isTesting: boolean;
  runs: BacktestRun[];
  onSelectStrategy: (id: string) => void;
  onRun: () => void;
}

export function BacktestView({
  strategies,
  plan,
  backtestCount,
  isAdmin,
  selectedStratId,
  isTesting,
  runs,
  onSelectStrategy,
  onRun,
}: Props) {
  const latest = runs[0];
  const chart = useMemo(
    () => (latest ? equitySparkPath(latest.stats.equity, 800, 240) : ''),
    [latest],
  );
  const positive = latest ? latest.stats.netProfit >= 0 : true;

  const basicLeft = Math.max(0, 5 - backtestCount);
  const limitNote =
    plan === 'STARTER'
      ? 'Backtests are not included in the Starter plan — upgrade to run them.'
      : plan === 'BASIC' && !isAdmin
        ? `${basicLeft} of 5 monthly backtests remaining.`
        : 'Unlimited backtests on your plan.';

  return (
    <div className="absolute inset-0 bg-black p-6 md:p-10 flex flex-col items-center overflow-y-auto z-20">
      <div className="max-w-5xl w-full pb-20">
        <div className="flex items-end justify-between border-b border-white/10 pb-6 mb-8 flex-wrap gap-3">
          <h2 className="text-3xl font-bold tracking-tight text-white">Backtesting Engine</h2>
          <span className="text-xs text-zinc-500 tracking-widest">{limitNote.toUpperCase()}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-5 bg-zinc-950 p-6 rounded-xl border border-white/10 h-fit">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 tracking-widest">STRATEGY</label>
              <select
                value={selectedStratId}
                onChange={(e) => onSelectStrategy(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 p-3 rounded-md text-sm text-white outline-none focus:border-terminal-green/60 transition-colors"
              >
                <option value="">Choose a strategy...</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onRun}
              disabled={isTesting || !selectedStratId}
              className="w-full bg-terminal-green text-black py-3 rounded-md font-bold text-sm tracking-widest hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isTesting && (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              )}
              {isTesting ? 'RUNNING SIMULATION...' : 'RUN BACKTEST'}
            </button>
            <p className="text-[10px] text-zinc-600 leading-relaxed normal-case tracking-normal">
              Deterministic simulated engine — same strategy always yields the same result. Illustrative
              only, not trading advice.
            </p>
          </div>

          <div className="lg:col-span-2 bg-zinc-950 p-6 rounded-xl border border-white/10 min-h-[420px] relative">
            {isTesting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/85 z-10 rounded-xl backdrop-blur-sm">
                <div className="w-8 h-8 border-2 border-zinc-600 border-t-terminal-green rounded-full animate-spin mb-4" />
                <div className="text-sm text-zinc-400 font-medium">Processing simulated market data...</div>
              </div>
            )}
            {latest ? (
              <div>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <div className="text-white font-bold">{latest.strategyTitle}</div>
                    <div className="text-[10px] text-zinc-500 tracking-widest">
                      {new Date(latest.ranAt).toLocaleString()}
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${positive ? 'text-terminal-green' : 'text-red-400'}`}>
                    {formatUsd(latest.stats.netProfit)}
                  </div>
                </div>
                <svg viewBox="0 0 800 240" className="w-full h-52" preserveAspectRatio="none" role="img" aria-label="Backtest equity curve">
                  <defs>
                    <linearGradient id="btFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={positive ? '#00ff41' : '#f87171'} stopOpacity="0.22" />
                      <stop offset="100%" stopColor={positive ? '#00ff41' : '#f87171'} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${chart} L800,240 L0,240 Z`} fill="url(#btFill)" />
                  <path d={chart} fill="none" stroke={positive ? '#00ff41' : '#f87171'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                  {[
                    ['WIN RATE', `${latest.stats.winRate.toFixed(1)}%`],
                    ['PROFIT FACTOR', latest.stats.profitFactor.toFixed(2)],
                    ['MAX DRAWDOWN', `${latest.stats.maxDrawdown.toFixed(1)}%`],
                    ['TRADES', String(latest.stats.trades)],
                  ].map(([label, value]) => (
                    <div key={label} className="p-4 bg-zinc-900/70 rounded-lg border border-white/5">
                      <div className="text-[10px] text-zinc-500 font-bold tracking-widest mb-1">{label}</div>
                      <div className="text-lg font-bold text-white">{value}</div>
                    </div>
                  ))}
                </div>

                {runs.length > 1 && (
                  <div className="mt-6">
                    <div className="text-[10px] text-zinc-500 font-bold tracking-widest mb-2">RUN HISTORY (THIS SESSION)</div>
                    <div className="space-y-1.5">
                      {runs.slice(1, 6).map((r) => (
                        <div key={r.runId} className="flex items-center justify-between text-xs bg-zinc-900/50 border border-white/5 rounded-md px-3 py-2">
                          <span className="text-zinc-300 truncate">{r.strategyTitle}</span>
                          <span className={r.stats.netProfit >= 0 ? 'text-terminal-green' : 'text-red-400'}>
                            {formatUsd(r.stats.netProfit)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full min-h-[380px] flex items-center justify-center text-zinc-600 text-sm">
                Select a strategy and run a backtest to see results.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
