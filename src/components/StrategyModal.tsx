import { useMemo, useState } from 'react';
import { equitySparkPath, formatUsd, runBacktestEngine } from '../lib/backtest';
import type { Strategy } from '../lib/types';
import { useToast } from './Toast';

interface Props {
  strategy: Strategy;
  onClose: () => void;
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-4 bg-zinc-900/70 rounded-lg border border-white/5">
      <div className="text-[10px] text-zinc-500 font-bold tracking-widest mb-1.5">{label}</div>
      <div className={`text-xl font-bold ${accent ? 'text-terminal-green' : 'text-white'}`}>{value}</div>
    </div>
  );
}

export function StrategyModal({ strategy, onClose }: Props) {
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);
  const stats = useMemo(() => runBacktestEngine(strategy.id), [strategy.id]);
  const chart = useMemo(() => equitySparkPath(stats.equity, 800, 220), [stats]);
  const positive = stats.netProfit >= 0;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(strategy.content);
      setCopied(true);
      notify('Strategy code copied to clipboard.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Clipboard unavailable in this browser.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[70] flex flex-col p-4 md:p-10 overflow-hidden backdrop-blur-sm">
      <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col bg-zinc-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-h-0">
        <div className="flex justify-between items-start border-b border-white/10 p-5 md:p-6 bg-zinc-900/50 gap-4">
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">{strategy.title}</h2>
            <div className="text-xs text-zinc-500 mt-2 tracking-widest">
              {strategy.assetCategory} · {(strategy.timeframes ?? []).join(' / ')}
              {strategy.isAutoTrade && <span className="text-yellow-400 font-bold"> · AUTOTRADE</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors px-4 py-2 rounded-md hover:bg-white/5 text-xs font-bold tracking-widest shrink-0 border border-white/10"
          >
            CLOSE
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-8 min-h-0">
          <p className="text-zinc-300 text-sm md:text-base leading-relaxed mb-8 normal-case tracking-normal">
            {strategy.description}
          </p>

          {/* Simulated performance */}
          <div className="mb-8 rounded-xl border border-white/10 bg-black/50 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-xs font-bold text-zinc-400 tracking-widest">
                SIMULATED PERFORMANCE <span className="text-zinc-600">(deterministic demo engine)</span>
              </h3>
              <span className={`text-sm font-bold ${positive ? 'text-terminal-green' : 'text-red-400'}`}>
                {formatUsd(stats.netProfit)} NET
              </span>
            </div>
            <svg viewBox="0 0 800 220" className="w-full h-48 md:h-56" preserveAspectRatio="none" role="img" aria-label="Simulated equity curve">
              <defs>
                <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={positive ? '#00ff41' : '#f87171'} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={positive ? '#00ff41' : '#f87171'} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${chart} L800,220 L0,220 Z`} fill="url(#eqFill)" />
              <path d={chart} fill="none" stroke={positive ? '#00ff41' : '#f87171'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
              <StatCell label="WIN RATE" value={`${stats.winRate.toFixed(1)}%`} accent={stats.winRate >= 50} />
              <StatCell label="PROFIT FACTOR" value={stats.profitFactor.toFixed(2)} accent={stats.profitFactor >= 1.5} />
              <StatCell label="MAX DRAWDOWN" value={`${stats.maxDrawdown.toFixed(1)}%`} />
              <StatCell label="TRADES" value={String(stats.trades)} />
              <StatCell label="NET PROFIT" value={formatUsd(stats.netProfit)} accent={positive} />
            </div>
          </div>

          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-zinc-400 tracking-widest">PINE SCRIPT SOURCE</h3>
            <button
              onClick={copyCode}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold tracking-widest transition-all ${
                copied ? 'bg-terminal-green text-black' : 'bg-white text-black hover:bg-zinc-200'
              }`}
            >
              {copied ? 'COPIED' : 'COPY CODE'}
            </button>
          </div>
          <pre className="bg-black border border-white/5 rounded-lg p-5 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed whitespace-pre normal-case">
            {strategy.content}
          </pre>
        </div>
      </div>
    </div>
  );
}
